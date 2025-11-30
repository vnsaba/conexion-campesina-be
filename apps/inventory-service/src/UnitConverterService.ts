import { Injectable, BadRequestException } from '@nestjs/common';
import { create, all } from 'mathjs';

// Mapeo: Llave (Tu Enum Prisma) -> Valor (Unidad MathJS)
const UNIT_MAP: Record<string, string> = {
  // Masa
  KILOGRAMO: 'kg',
  GRAMO: 'g',
  TONELADA: 'tonne',
  LIBRA: 'lb',
  ARROBA: 'Arroba', // Custom
  CARGA: 'Carga', // Custom
  BULTO: 'Bulto', // Custom
  SACO: 'Saco', // Custom

  // Volumen
  LITRO: 'l',
  MILILITRO: 'ml',
  BOTELLA: 'Botella', // Custom
  CUARTILLA: 'Cuartilla', // Custom

  // Conteo (Unidades)
  UNIDAD: 'Unidad', // Custom base
  DOCENA: 'Docena',
  MEDIA_DOCENA: 'MediaDocena',
  PAR: 'Par',
  MANOJO: 'Manojo',
  ATADO: 'Atado',
  RACIMO: 'Racimo',
  CAJA: 'Caja',
  CANASTA: 'Canasta',
};

@Injectable()
export class UnitConverterService {
  private math = create(all, {});
  private unitCategories = new Map<string, string>();

  constructor() {
    // === MASA (Base: kg) ===
    this.safeRegisterMassUnit('KILOGRAMO');
    this.safeRegisterMassUnit('GRAMO');
    this.safeRegisterMassUnit('TONELADA');
    this.safeRegisterMassUnit('LIBRA');

    // Definiciones Custom de Masa
    this.safeRegisterMassUnit('ARROBA', '12.5 kg');
    this.safeRegisterMassUnit('CARGA', '125 kg');
    this.safeRegisterMassUnit('BULTO', '50 kg');
    this.safeRegisterMassUnit('SACO', '50 kg');

    // === VOLUMEN (Base: l) ===
    this.safeRegisterVolumeUnit('LITRO');
    this.safeRegisterVolumeUnit('MILILITRO');

    // Definiciones Custom de Volumen
    this.safeRegisterVolumeUnit('BOTELLA', '0.75 l');
    this.safeRegisterVolumeUnit('CUARTILLA', '0.25 l');

    // === CONTEO (Base: Unidad) ===
    this.math.createUnit('Unidad', { aliases: ['unidad', 'u'] });
    this.unitCategories.set('UNIDAD', 'count');

    this.safeRegisterCountUnit('DOCENA', '12 Unidad');
    this.safeRegisterCountUnit('MEDIA_DOCENA', '6 Unidad');
    this.safeRegisterCountUnit('PAR', '2 Unidad');

    this.safeRegisterCountUnit('MANOJO', '1 Unidad');
    this.safeRegisterCountUnit('ATADO', '1 Unidad');
    this.safeRegisterCountUnit('RACIMO', '1 Unidad');
    this.safeRegisterCountUnit('CAJA', '1 Unidad');
    this.safeRegisterCountUnit('CANASTA', '1 Unidad');
  }

  /** Registers a unit safely for mathjs */
  private safeRegister(category: string, prismaUnit: string, def?: string) {
    const mathUnit = UNIT_MAP[prismaUnit];
    if (!mathUnit) {
      console.warn(`Unit '${prismaUnit}' missing in UNIT_MAP`);
      return;
    }

    try {
      if (def) {
        this.math.createUnit(mathUnit, { definition: def }, { override: true });
      } else if (!this.math.unit(mathUnit).toJSON()) {
        this.math.createUnit(mathUnit);
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      /* empty */
    }

    this.unitCategories.set(prismaUnit, category);
  }

  private safeRegisterMassUnit(unit: string, def?: string) {
    this.safeRegister('mass', unit, def);
  }

  private safeRegisterVolumeUnit(unit: string, def?: string) {
    this.safeRegister('volume', unit, def);
  }

  private safeRegisterCountUnit(unit: string, def?: string) {
    this.safeRegister('count', unit, def);
  }

  /** * Convierte valores.
   * @param value Cantidad a convertir (ej. 500)
   * @param from Unidad origen en Enum Prisma (ej. "GRAMO")
   * @param to Unidad destino en Enum Prisma (ej. "KILOGRAMO")
   */
  convert(value: number, from: string, to: string): number {
    if (from === to) return value;

    const catFrom = this.unitCategories.get(from);
    const catTo = this.unitCategories.get(to);

    if (!catFrom || !catTo) {
      throw new BadRequestException(
        `Unidades no registradas en el sistema de conversión: '${from}' o '${to}'`,
      );
    }

    if (catFrom !== catTo) {
      throw new BadRequestException(
        `Incompatible: No se puede convertir ${from} (${catFrom}) a ${to} (${catTo})`,
      );
    }

    const fromMath = UNIT_MAP[from];
    const toMath = UNIT_MAP[to];

    try {
      const result = this.math.unit(value, fromMath).toNumber(toMath);
      return Number(result.toFixed(2)); // Siempre 2 decimales
    } catch (e) {
      throw new BadRequestException(
        `Error matemático al convertir ${value} ${from} a ${to}: ${e.message}`,
      );
    }
  }
}
