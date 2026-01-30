export class PDFValidator {
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly PDF_MAGIC_NUMBER = Buffer.from('%PDF-');

  /**
   * Validate PDF file before processing
   */
  static async validate(buffer: Buffer, filename: string): Promise<{ valid: boolean; error?: string }> {
    // Check file size
    if (buffer.length > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File too large. Maximum size is ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
      };
    }

    // Check if file is empty
    if (buffer.length === 0) {
      return {
        valid: false,
        error: 'File is empty'
      };
    }

    // Check PDF magic number
    const magicNumber = buffer.subarray(0, 5);
    if (!magicNumber.equals(this.PDF_MAGIC_NUMBER)) {
      return {
        valid: false,
        error: 'Invalid file format. Only PDF files are accepted.'
      };
    }

    // Check filename extension
    if (!filename.toLowerCase().endsWith('.pdf')) {
      return {
        valid: false,
        error: 'File must have .pdf extension'
      };
    }

    return { valid: true };
  }

  /**
   * Extract document metadata from PDF
   * This reads the custom metadata that AcadCert embeds
   */
  static async extractMetadata(buffer: Buffer): Promise<{
    documentId?: string;
    institutionId?: string;
    documentHash?: string;
    signature?: string;
  }> {
    try {
      // Dynamically import PDF.js (ESM)
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

      // Load PDF
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        verbosity: 0
      });

      const pdf = await loadingTask.promise;
      const metadata = await pdf.getMetadata();

      // Extract custom metadata from info dict
      const info = metadata.info as any;

      return {
        documentId: info.Subject || undefined, // AcadCert stores doc ID in Subject
        institutionId: info.Creator || undefined,
        documentHash: info.Keywords || undefined,
        signature: info.Producer || undefined
      };
    } catch (error: any) {
      console.error('PDF metadata extraction failed:', error.message);
      return {};
    }
  }

  /**
   * Security check - scan for malicious content
   */
  static async securityScan(buffer: Buffer): Promise<{ safe: boolean; threats?: string[] }> {
    const pdfText = buffer.toString('utf-8').toLowerCase();
    const threats: string[] = [];

    // Check for forbidden JavaScript
    if (pdfText.includes('/javascript') || pdfText.includes('/js')) {
      threats.push('JavaScript detected');
    }

    // Check for auto-actions
    if (pdfText.includes('/aa') || pdfText.includes('/openaction')) {
      threats.push('Auto-action detected');
    }

    // Check for launch actions
    if (pdfText.includes('/launch')) {
      threats.push('Launch action detected');
    }

    // Check for form submission
    if (pdfText.includes('/submitform')) {
      threats.push('Form submission detected');
    }

    return {
      safe: threats.length === 0,
      threats: threats.length > 0 ? threats : undefined
    };
  }
}
