/**
 * Document Generation Engine — Artha's primary differentiator.
 * Converts natural-language prompts into polished DOCX, PPTX, XLSX, PDF files.
 * Each generator uses a proven npm library; no extra runtime required.
 */
import * as path from 'path';
import * as fs from 'fs';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  LevelFormat, TableOfContents, Header, Footer, PageNumber
} from 'docx';
import PptxGenJS from 'pptxgenjs';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getActiveLLMClient } from '../llm/client';

export type DocType = 'docx' | 'pptx' | 'xlsx' | 'pdf';

export interface GenerateOptions {
  type: DocType;
  prompt: string;         // Natural-language instruction
  outPath: string;        // Absolute path for output file
  contextChunks?: string[]; // RAG-retrieved context to ground content
}

// ── Main entry point ────────────────────────────────────────────────────────

export async function generateDocument(opts: GenerateOptions): Promise<string> {
  // Step 1: Use LLM to produce structured content from the prompt
  const content = await planDocumentContent(opts.prompt, opts.contextChunks ?? []);

  // Step 2: Render the structured content into the target format
  switch (opts.type) {
    case 'docx': return generateDocx(content, opts.outPath);
    case 'pptx': return generatePptx(content, opts.outPath);
    case 'xlsx': return generateXlsx(content, opts.outPath);
    case 'pdf':  return generatePdf(content, opts.outPath);
    default: throw new Error(`Unsupported document type: ${opts.type}`);
  }
}

// ── LLM Content Planner ─────────────────────────────────────────────────────

interface DocumentContent {
  title: string;
  sections: Array<{
    heading: string;
    body: string;
    table?: { headers: string[]; rows: string[][] };
    bullets?: string[];
  }>;
  metadata?: Record<string, string>;
}

async function planDocumentContent(
  prompt: string,
  contextChunks: string[]
): Promise<DocumentContent> {
  const llm = getActiveLLMClient();
  const context = contextChunks.length
    ? `\n\nRelevant context from user's files:\n${contextChunks.join('\n---\n')}`
    : '';

  const response = await llm.complete([
    {
      role: 'system',
      content: `You are Artha's document architect. Given a user request, produce structured document content as JSON.

Schema:
{
  "title": "Document Title",
  "sections": [
    {
      "heading": "Section Title",
      "body": "Paragraph text...",
      "bullets": ["Point 1", "Point 2"],
      "table": { "headers": ["Col1","Col2"], "rows": [["r1c1","r1c2"]] }
    }
  ],
  "metadata": { "author": "...", "date": "...", "subject": "..." }
}

Be thorough, professional, and use the provided context to ground factual claims.${context}`,
    },
    { role: 'user', content: prompt },
  ]);

  const raw = response.choices[0]?.message?.content ?? '{}';
  try {
    return JSON.parse(raw.replace(/```json\n?|\n?```/g, ''));
  } catch {
    return { title: 'Document', sections: [{ heading: 'Content', body: raw }] };
  }
}

// ── DOCX Generator ──────────────────────────────────────────────────────────

async function generateDocx(content: DocumentContent, outPath: string): Promise<string> {
  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
  const borders = { top: border, bottom: border, left: border, right: border };

  const bodyChildren: (Paragraph | Table)[] = [
    new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-2' }),
    new Paragraph({ children: [] }),
  ];

  for (const section of content.sections) {
    bodyChildren.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(section.heading)] })
    );

    if (section.body) {
      bodyChildren.push(
        new Paragraph({ spacing: { after: 160 }, children: [new TextRun(section.body)] })
      );
    }

    if (section.bullets?.length) {
      for (const bullet of section.bullets) {
        bodyChildren.push(
          new Paragraph({
            numbering: { reference: 'bullets', level: 0 },
            spacing: { after: 80 },
            children: [new TextRun(bullet)],
          })
        );
      }
    }

    if (section.table) {
      const { headers, rows } = section.table;
      const colW = Math.floor(9360 / headers.length);
      const colWidths = headers.map(() => colW);

      bodyChildren.push(
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: colWidths,
          rows: [
            new TableRow({
              children: headers.map((h, i) =>
                new TableCell({
                  borders, width: { size: colWidths[i], type: WidthType.DXA },
                  shading: { fill: '1B4F72', type: ShadingType.CLEAR },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20 })] })],
                })
              ),
            }),
            ...rows.map((row, ri) =>
              new TableRow({
                children: row.map((cell, ci) =>
                  new TableCell({
                    borders, width: { size: colWidths[ci], type: WidthType.DXA },
                    shading: { fill: ri % 2 === 0 ? 'FFFFFF' : 'EAF4FB', type: ShadingType.CLEAR },
                    margins: { top: 80, bottom: 80, left: 120, right: 120 },
                    children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20 })] })],
                  })
                ),
              })
            ),
          ],
        })
      );
      bodyChildren.push(new Paragraph({ children: [] }));
    }
  }

  const doc = new Document({
    numbering: { config: [{ reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, font: 'Arial', color: '1B4F72' }, paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: 'Arial', color: '2E86C1' }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: content.title, bold: true, color: '1B4F72', font: 'Arial', size: 18 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: 'Generated by Artha  •  ', color: '888888', font: 'Arial', size: 18 }), new TextRun({ children: [PageNumber.CURRENT], color: '888888', font: 'Arial', size: 18 })] })] }) },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1440, after: 480 }, children: [new TextRun({ text: content.title, size: 52, bold: true, color: '1B4F72', font: 'Arial' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1440 }, children: [new TextRun({ text: content.metadata?.date ?? new Date().toLocaleDateString(), color: '888888', font: 'Arial', size: 22 })] }),
        ...bodyChildren,
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

// ── PPTX Generator ──────────────────────────────────────────────────────────

async function generatePptx(content: DocumentContent, outPath: string): Promise<string> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = content.title;
  pptx.author = content.metadata?.author ?? 'Artha';

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: '1B4F72' };
  titleSlide.addText(content.title, { x: 0.5, y: 2.5, w: 12, h: 1.5, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center' });
  titleSlide.addText(content.metadata?.date ?? new Date().toLocaleDateString(), { x: 0.5, y: 4.2, w: 12, h: 0.5, fontSize: 18, color: 'AED6F1', align: 'center' });
  titleSlide.addText('Generated by Artha', { x: 0.5, y: 6.5, w: 12, h: 0.3, fontSize: 12, color: '7FB3D3', align: 'center' });

  // Content slides
  for (const section of content.sections) {
    const slide = pptx.addSlide();
    slide.addText(section.heading, { x: 0.4, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: '1B4F72' });
    slide.addShape(pptx.ShapeType.line, { x: 0.4, y: 1.1, w: 12, h: 0, line: { color: '2E86C1', width: 2 } });

    if (section.bullets?.length) {
      const bulletText = section.bullets.map(b => ({ text: b, options: { bullet: true, fontSize: 18, color: '1A252F', paraSpaceBefore: 6 } }));
      slide.addText(bulletText, { x: 0.5, y: 1.3, w: 11.5, h: 5 });
    } else if (section.body) {
      slide.addText(section.body, { x: 0.5, y: 1.3, w: 11.5, h: 5, fontSize: 18, color: '1A252F', valign: 'top', wrap: true });
    }

    if (section.table) {
      const tableData = [
        section.table.headers.map(h => ({ text: h, options: { bold: true, color: 'FFFFFF', fill: { color: '1B4F72' } } })),
        ...section.table.rows.map(row => row.map(cell => ({ text: cell }))),
      ];
      slide.addTable(tableData, { x: 0.5, y: 1.3, w: 12, fontSize: 14 });
    }
  }

  await pptx.writeFile({ fileName: outPath });
  return outPath;
}

// ── XLSX Generator ──────────────────────────────────────────────────────────

async function generateXlsx(content: DocumentContent, outPath: string): Promise<string> {
  const wb = XLSX.utils.book_new();

  for (const section of content.sections) {
    const rows: unknown[][] = [];
    rows.push([section.heading]);
    rows.push([]);

    if (section.table) {
      rows.push(section.table.headers);
      rows.push(...section.table.rows);
    } else if (section.bullets?.length) {
      for (const b of section.bullets) rows.push([b]);
    } else if (section.body) {
      rows.push([section.body]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const safeName = section.heading.replace(/[\\/:*?[\]]/g, '').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeName || 'Sheet');
  }

  XLSX.writeFile(wb, outPath);
  return outPath;
}

// ── PDF Generator ───────────────────────────────────────────────────────────

async function generatePdf(content: DocumentContent, outPath: string): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const addPage = () => {
    const page = pdfDoc.addPage([612, 792]); // US Letter
    return { page, y: 740 };
  };

  let { page, y } = addPage();
  const margin = 72;
  const lineH = 16;

  const writeLine = (text: string, size: number, isBold = false, color = rgb(0, 0, 0)) => {
    if (y < margin + 40) { const np = addPage(); page = np.page; y = np.y; }
    page.drawText(text.slice(0, 90), { x: margin, y, size, font: isBold ? boldFont : font, color });
    y -= lineH * (size / 12);
  };

  writeLine(content.title, 24, true, rgb(0.11, 0.31, 0.45));
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: 612 - margin, y }, thickness: 1, color: rgb(0.18, 0.53, 0.76) });
  y -= 20;

  for (const section of content.sections) {
    writeLine(section.heading, 16, true, rgb(0.11, 0.31, 0.45));
    y -= 4;
    if (section.body) {
      const words = section.body.split(' ');
      let line = '';
      for (const word of words) {
        if ((line + word).length > 80) { writeLine(line, 11); line = word + ' '; }
        else line += word + ' ';
      }
      if (line.trim()) writeLine(line, 11);
    }
    if (section.bullets) for (const b of section.bullets) writeLine(`  • ${b}`, 11);
    y -= 10;
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outPath, pdfBytes);
  return outPath;
}
