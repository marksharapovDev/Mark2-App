import fs from 'fs';
import path from 'path';

export interface ProcessedFiles {
  /** Text content to inject into prompt (file contents, extracted text) */
  textContent: string;
  /** Base64-encoded images for multimodal API */
  images: Array<{ base64: string; mediaType: string }>;
  /** Unsupported file names */
  unsupported: string[];
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const TEXT_EXTS = new Set([
  '.txt', '.md', '.json', '.csv', '.ts', '.tsx', '.js', '.jsx',
  '.py', '.html', '.css', '.yml', '.yaml', '.toml', '.xml',
  '.sh', '.bash', '.zsh', '.sql', '.env', '.cfg', '.ini',
  '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp', '.rb',
  '.swift', '.kt', '.scala', '.r', '.lua', '.php',
]);

function getMediaType(ext: string): string {
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.gif': return 'image/gif';
    default: return 'application/octet-stream';
  }
}

export async function processAttachedFiles(filePaths: string[]): Promise<ProcessedFiles> {
  const textParts: string[] = [];
  const images: ProcessedFiles['images'] = [];
  const unsupported: string[] = [];

  for (const filePath of filePaths) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);

    try {
      if (IMAGE_EXTS.has(ext)) {
        const buffer = fs.readFileSync(filePath);
        images.push({
          base64: buffer.toString('base64'),
          mediaType: getMediaType(ext),
        });
      } else if (TEXT_EXTS.has(ext)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        textParts.push(`Содержимое файла ${fileName}:\n\`\`\`\n${content}\n\`\`\``);
      } else if (ext === '.docx') {
        const text = await extractDocx(filePath);
        textParts.push(`Содержимое файла ${fileName}:\n\`\`\`\n${text}\n\`\`\``);
      } else if (ext === '.pdf') {
        const text = await extractPdf(filePath);
        textParts.push(`Содержимое файла ${fileName}:\n\`\`\`\n${text}\n\`\`\``);
      } else {
        unsupported.push(fileName);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[FileProcessor] Failed to process ${fileName}:`, msg);
      textParts.push(`Не удалось прочитать файл ${fileName}: ${msg}`);
    }
  }

  if (unsupported.length > 0) {
    textParts.push(`Формат не поддерживается для чтения: ${unsupported.join(', ')}`);
  }

  return {
    textContent: textParts.join('\n\n'),
    images,
    unsupported,
  };
}

async function extractDocx(filePath: string): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function extractPdf(filePath: string): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}
