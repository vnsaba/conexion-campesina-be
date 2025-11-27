import puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export class PdfGenerator {
  private templatePath: string;
  private compiledTemplate: HandlebarsTemplateDelegate | null = null;

  constructor() {
    this.templatePath = path.join(
      __dirname,
      '..',
      'templates',
      'receipt-template.hbs',
    );

    this.ensureTemplateExists();
    this.loadTemplate();
  }

  /**
   * Validate that the template exists in the expected directory
   */
  private ensureTemplateExists() {
    if (!fs.existsSync(this.templatePath)) {
      throw new Error(
        `Shipping receipt template not found: ${this.templatePath}`,
      );
    }
  }

  /**
   * Load and pre-compile Handlebars template so it is not reloaded on every call
   */
  private loadTemplate() {
    // Register Handlebars helpers
    this.registerHelpers();

    const templateSource = fs.readFileSync(this.templatePath, 'utf-8');
    this.compiledTemplate = handlebars.compile(templateSource, {
      strict: false, // Allow optional fields
    });
  }

  /**
   * Register Handlebars helpers for formatting
   */
  private registerHelpers() {
    // Format date helper
    handlebars.registerHelper('formatDate', (date: string | Date) => {
      if (!date) return 'N/A';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    });

    // Format currency helper
    handlebars.registerHelper('formatCurrency', (value: number) => {
      if (value === undefined || value === null) return '$0';
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
      }).format(value);
    });

    // Format weight helper
    handlebars.registerHelper('formatWeight', (value: number) => {
      if (value === undefined || value === null) return '0';
      return value.toFixed(2);
    });
  }

  /**
   * Ensures Puppeteer can run correctly on Linux/Docker environments.
   */
  private async launchBrowser() {
    return puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    });
  }

  /**
   * Generates a PDF buffer from shipping receipt data from database
   * @param data ShippingReceipt from Prisma with items included
   * @returns Buffer containing the PDF (ready to be sent to frontend as a Blob)
   */
  async generateShippingReceipt(data: any): Promise<Buffer> {
    try {
      if (!this.compiledTemplate) {
        throw new Error('Handlebars template was not loaded correctly.');
      }

      // Prepare data with formatted values
      // Data comes from Prisma so generatedAt is already a Date object
      const templateData = {
        ...data,
        generatedAt: this.formatDate(data.generatedAt),
        dispatchDate: this.formatDate(data.dispatchDate),
        declaredValue: this.formatCurrency(data.declaredValue),
        shippingCost: this.formatCurrency(data.shippingCost),
        subtotal: this.formatCurrency(data.subtotal),
        total: this.formatCurrency(data.total),
        items: data.items.map((item) => ({
          ...item,
          weight: item.weight ? item.weight.toFixed(2) : '0.00',
        })),
        carrierName: data.carrierName || 'N/A',
        remesaNumber: data.remesaNumber || 'N/A',
      };

      // Render HTML with formatted data
      const html = this.compiledTemplate(templateData);

      const browser = await this.launchBrowser();
      const page = await browser.newPage();

      // Set HTML content
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      // PDF generation config
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '18mm',
          right: '18mm',
          bottom: '18mm',
          left: '18mm',
        },
        preferCSSPageSize: true,
      });

      await browser.close();

      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate shipping receipt PDF');
    }
  }

  /**
   * Format date to Spanish locale
   */
  private formatDate(date: any): string {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Format currency to Colombian Pesos
   */
  private formatCurrency(value?: any): string {
    if (value === undefined || value === null) return '$0';
    const numValue =
      typeof value === 'number' ? value : parseFloat(String(value));
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(numValue);
  }
}
