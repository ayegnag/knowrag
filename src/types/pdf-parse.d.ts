declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
    text: string;
  }

  function pdf(dataBuffer: Buffer | Uint8Array | ArrayBuffer, options?: any): Promise<PDFData>;

  export = pdf;
}