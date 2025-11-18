import { Injectable, BadRequestException } from '@nestjs/common';
import { create, all } from 'mathjs';

const UNIT_MAP: Record<string, string> = {
  Kg: 'Kg',
  g: 'g',
  L: 'L',
  mL: 'mL',
  t: 't',
  lb: 'lb',
  arroba: 'Arroba',
  Carga: 'Carga',
  Bulto: 'Bulto',
  Saco: 'Saco',
  Caja: 'Caja',
  Canasta: 'Canasta',
  Atado: 'Atado',
  Manojo: 'Manojo',
  Racimo: 'Racimo',
  Unidad: 'Unidad',
  Docena: 'Docena',
  Media_docena: 'MediaDocena', // 🔥 FIX
  Par: 'Par',
  Cuartilla: 'Cuartilla',
  Botella: 'Botella',
};

@Injectable()
export class UnitConverterService {
  private math = create(all, {});
  private unitCategories = new Map<string, string>();

  constructor() {
    // MASS
    this.safeRegisterMassUnit('Kg');
    this.safeRegisterMassUnit('g', '0.001 Kg');
    this.safeRegisterMassUnit('t', '1000 Kg');
    this.safeRegisterMassUnit('lb', '0.453592 Kg');
    this.safeRegisterMassUnit('arroba', '12.5 Kg');
    this.safeRegisterMassUnit('Carga', '125 Kg');
    this.safeRegisterMassUnit('Bulto', '50 Kg');
    this.safeRegisterMassUnit('Saco', '50 Kg');

    // VOLUME
    this.safeRegisterVolumeUnit('L');
    this.safeRegisterVolumeUnit('mL', '0.001 L');
    this.safeRegisterVolumeUnit('Botella', '0.75 L');
    this.safeRegisterVolumeUnit('Cuartilla', '0.25 L');

    // COUNT
    this.safeRegisterCountUnit('Unidad');
    this.safeRegisterCountUnit('Docena', '12 Unidad');
    this.safeRegisterCountUnit('Media_docena', '12 Unidad'); // 🔥 fix: valid name inside map
    this.safeRegisterCountUnit('Par', '2 Unidad');
    this.safeRegisterCountUnit('Manojo');
    this.safeRegisterCountUnit('Atado');
    this.safeRegisterCountUnit('Racimo');
    this.safeRegisterCountUnit('Caja');
    this.safeRegisterCountUnit('Canasta');
  }

  /** Registers a unit safely for mathjs */
  private safeRegister(category: string, prismaUnit: string, def?: string) {
    const mathUnit = UNIT_MAP[prismaUnit];
    if (!mathUnit) {
      throw new Error(`Unit '${prismaUnit}' has no mathjs mapping in UNIT_MAP`);
    }

    try {
      if (def) {
        this.math.createUnit(mathUnit, { definition: def });
      } else {
        this.math.createUnit(mathUnit);
      }
    } catch (e) {
      // Ignore duplicated units
      if (!String(e).includes('already exists')) {
        throw e;
      }
    }

    // Store category using Prisma's original name
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

  /** Converts using Prisma names but mathjs uses mapped names */
  convert(value: number, from: string, to: string): number {
    if (from === to) return value;

    const catFrom = this.unitCategories.get(from);
    const catTo = this.unitCategories.get(to);

    if (!catFrom || !catTo) {
      throw new BadRequestException(
        `Unidades no registradas en el sistema: ${from} o ${to}`,
      );
    }

    if (catFrom !== catTo) {
      throw new BadRequestException(
        `No se puede convertir entre categorías diferentes: ${from} (${catFrom}) → ${to} (${catTo})`,
      );
    }

    const fromMath = UNIT_MAP[from];
    const toMath = UNIT_MAP[to];

    try {
      return this.math.unit(`${value} ${fromMath}`).toNumber(toMath);
    } catch (e) {
      throw new BadRequestException(
        `Error convirtiendo ${value} ${from} → ${to}: ${e}`,
      );
    }
  }
}
