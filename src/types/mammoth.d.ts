declare module "mammoth" {
  interface ExtractResult {
    value: string;
    messages: unknown[];
  }

  interface Image {
    contentType: string;
    read: (encoding: "base64" | "binary") => Promise<string>;
  }

  interface ImgElementResult {
    src: string;
  }

  interface ConvertImage {
    imgElement: (
      fn: (image: Image) => Promise<ImgElementResult> | ImgElementResult,
    ) => unknown;
  }

  interface Mammoth {
    extractRawText: (input: { buffer: Buffer }) => Promise<ExtractResult>;
    convertToHtml: (
      input: { buffer: Buffer },
      options?: { convertImage?: unknown },
    ) => Promise<ExtractResult>;
    images: ConvertImage;
  }

  const mammoth: Mammoth;
  export default mammoth;
}
