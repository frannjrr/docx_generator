#!/usr/bin/env node
/**
 * generar_docx.js — Generador universal de documentos .docx profesionales
 * 
 * Uso:
 *   node generar_docx.js --input documento.json --output resultado.docx
 *
 * El JSON de entrada define la estructura completa del documento.
 * Ver esquema en: scripts/esquema_documento.json
 */

const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, LevelFormat, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
  TableOfContents, ExternalHyperlink, TabStopType, TabStopPosition,
} = require("docx");

// ─── Argumentos ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const inputIdx  = args.indexOf("--input");
const outputIdx = args.indexOf("--output");

if (inputIdx === -1 || outputIdx === -1) {
  console.error("Uso: node generar_docx.js --input doc.json --output doc.docx");
  process.exit(1);
}

const inputFile  = args[inputIdx + 1];
const outputFile = args[outputIdx + 1];

let spec;
try {
  spec = JSON.parse(fs.readFileSync(inputFile, "utf8"));
} catch (e) {
  console.error("Error leyendo JSON de entrada:", e.message);
  process.exit(1);
}

// ─── Paleta de colores corporativa ─────────────────────────────────────────
const COLOR = {
  primario:    spec.color_primario    || "1B3A6B",   // azul marino
  secundario:  spec.color_secundario  || "2E75B6",   // azul medio
  acento:      spec.color_acento      || "00B0F0",   // azul claro
  cabecera_bg: spec.color_cabecera_bg || "1B3A6B",   // fondo cabecera tabla
  fila_par:    spec.color_fila_par    || "EAF2FB",   // fila alterna tabla
  fila_impar:  "FFFFFF",
  texto:       "1A1A2E",
  subtexto:    "5A6A85",
  blanco:      "FFFFFF",
};

// ─── Estilos globales ───────────────────────────────────────────────────────
const ESTILOS = {
  default: {
    document: { run: { font: "Arial", size: 22, color: COLOR.texto } },
  },
  paragraphStyles: [
    {
      id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 36, bold: true, font: "Arial", color: COLOR.primario },
      paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0,
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.secundario, space: 6 } } },
    },
    {
      id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 28, bold: true, font: "Arial", color: COLOR.secundario },
      paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 },
    },
    {
      id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 24, bold: true, font: "Arial", color: COLOR.subtexto },
      paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
    },
  ],
};

const NUMERACION = {
  config: [
    {
      reference: "bullets",
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { run: { font: "Arial", size: 22 }, paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
          style: { run: { font: "Arial", size: 22 }, paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ],
    },
    {
      reference: "numeros",
      levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { run: { font: "Arial", size: 22 }, paragraph: { indent: { left: 720, hanging: 360 } } } },
      ],
    },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function borde(color = "CCCCCC") {
  const b = { style: BorderStyle.SINGLE, size: 1, color };
  return { top: b, bottom: b, left: b, right: b };
}

function celda(texto, opciones = {}) {
  const {
    bgColor, bold = false, center = false, width = 2000, isHeader = false,
  } = opciones;

  return new TableCell({
    borders: borde(isHeader ? COLOR.primario : "D0D9E8"),
    width: { size: width, type: WidthType.DXA },
    shading: bgColor ? { fill: bgColor, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    children: [new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({
        text: String(texto ?? ""),
        font: "Arial", size: isHeader ? 20 : 20,
        bold: bold || isHeader,
        color: isHeader ? COLOR.blanco : COLOR.texto,
      })],
    })],
  });
}

function construirTabla(bloqueTabla) {
  const { columnas, filas, ancho_total = 9360 } = bloqueTabla;
  const numCols   = columnas.length;
  const anchoCol  = Math.floor(ancho_total / numCols);
  const anchosCols = columnas.map((_, i) =>
    i < numCols - 1 ? anchoCol : ancho_total - anchoCol * (numCols - 1)
  );

  const filaCabecera = new TableRow({
    tableHeader: true,
    children: columnas.map((col, i) =>
      celda(col, { bgColor: COLOR.cabecera_bg, isHeader: true, width: anchosCols[i] })
    ),
  });

  const filasData = filas.map((fila, rowIdx) => {
    const bg = rowIdx % 2 === 0 ? COLOR.fila_impar : COLOR.fila_par;
    const celdas = Array.isArray(fila)
      ? fila.map((val, i) => celda(val, { bgColor: bg, width: anchosCols[i] }))
      : columnas.map((col, i) => celda(fila[col] ?? fila[Object.keys(fila)[i]] ?? "", { bgColor: bg, width: anchosCols[i] }));
    return new TableRow({ children: celdas });
  });

  return new Table({
    width: { size: ancho_total, type: WidthType.DXA },
    columnWidths: anchosCols,
    rows: [filaCabecera, ...filasData],
  });
}

function construirBloque(bloque) {
  const elementos = [];

  switch (bloque.tipo) {

    case "titulo1":
      elementos.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: bloque.texto, font: "Arial", size: 36, bold: true, color: COLOR.primario })],
      }));
      break;

    case "titulo2":
      elementos.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: bloque.texto, font: "Arial", size: 28, bold: true, color: COLOR.secundario })],
      }));
      break;

    case "titulo3":
      elementos.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: bloque.texto, font: "Arial", size: 24, bold: true, color: COLOR.subtexto })],
      }));
      break;

    case "parrafo":
      elementos.push(new Paragraph({
        alignment: bloque.alineacion === "centro" ? AlignmentType.CENTER
                 : bloque.alineacion === "derecha" ? AlignmentType.RIGHT
                 : AlignmentType.LEFT,
        spacing: { before: 80, after: 80 },
        children: [new TextRun({
          text: bloque.texto,
          font: "Arial", size: 22,
          bold:   bloque.negrita   || false,
          italics: bloque.cursiva  || false,
          color:  bloque.color     || COLOR.texto,
        })],
      }));
      break;

    case "parrafo_rich": {
      // Lista de segmentos: [{ texto, negrita, cursiva, color, enlace }]
      const runs = (bloque.segmentos || []).map(seg => {
        const run = new TextRun({
          text: seg.texto, font: "Arial", size: 22,
          bold: seg.negrita || false,
          italics: seg.cursiva || false,
          color: seg.color || COLOR.texto,
        });
        if (seg.enlace) {
          return new ExternalHyperlink({ link: seg.enlace, children: [run] });
        }
        return run;
      });
      elementos.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: runs }));
      break;
    }

    case "lista_bullets":
      (bloque.items || []).forEach(item => {
        elementos.push(new Paragraph({
          numbering: { reference: "bullets", level: bloque.nivel || 0 },
          children: [new TextRun({ text: item, font: "Arial", size: 22, color: COLOR.texto })],
        }));
      });
      break;

    case "lista_numerada":
      (bloque.items || []).forEach(item => {
        elementos.push(new Paragraph({
          numbering: { reference: "numeros", level: 0 },
          children: [new TextRun({ text: item, font: "Arial", size: 22, color: COLOR.texto })],
        }));
      });
      break;

    case "tabla":
      elementos.push(construirTabla(bloque));
      elementos.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } }));
      break;

    case "separador":
      elementos.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.secundario, space: 4 } },
        spacing: { before: 200, after: 200 },
        children: [new TextRun("")],
      }));
      break;

    case "salto_pagina":
      elementos.push(new Paragraph({ children: [new PageBreak()] }));
      break;

    case "alerta": {
      const coloresAlerta = {
        info:      { bg: "D6EAF8", borde: "2E75B6" },
        exito:     { bg: "D5F5E3", borde: "27AE60" },
        aviso:     { bg: "FEF9E7", borde: "F39C12" },
        error:     { bg: "FDEDEC", borde: "E74C3C" },
      };
      const estilo = coloresAlerta[bloque.nivel || "info"];
      elementos.push(new Paragraph({
        border: {
          top:    { style: BorderStyle.SINGLE, size: 4, color: estilo.borde },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: estilo.borde },
          left:   { style: BorderStyle.THICK,  size: 12, color: estilo.borde },
          right:  { style: BorderStyle.SINGLE, size: 4, color: estilo.borde },
        },
        shading: { fill: estilo.bg, type: ShadingType.CLEAR },
        spacing: { before: 160, after: 160 },
        indent:  { left: 360, right: 360 },
        children: [new TextRun({ text: bloque.texto, font: "Arial", size: 22, color: COLOR.texto })],
      }));
      break;
    }

    case "espacio":
      elementos.push(new Paragraph({
        spacing: { before: bloque.altura || 200, after: 0 },
        children: [new TextRun("")],
      }));
      break;

    default:
      // Bloque desconocido → párrafo de texto plano como fallback
      if (bloque.texto) {
        elementos.push(new Paragraph({
          children: [new TextRun({ text: String(bloque.texto), font: "Arial", size: 22 })],
        }));
      }
  }

  return elementos;
}

// ─── Portada ────────────────────────────────────────────────────────────────
function construirPortada(portada) {
  if (!portada) return [];
  const { titulo, subtitulo, autor, fecha, version, descripcion } = portada;
  const hoy = fecha || new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  return [
    new Paragraph({ spacing: { before: 1440, after: 0 }, children: [new TextRun("")] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [new TextRun({ text: titulo || "Documento", font: "Arial", size: 56, bold: true, color: COLOR.primario })],
    }),
    subtitulo && new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 480 },
      children: [new TextRun({ text: subtitulo, font: "Arial", size: 32, color: COLOR.secundario, italics: true })],
    }),
    descripcion && new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 720 },
      children: [new TextRun({ text: descripcion, font: "Arial", size: 24, color: COLOR.subtexto })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 720, after: 80 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.acento, space: 4 } },
      children: [new TextRun({ text: autor ? `Autor: ${autor}` : "", font: "Arial", size: 22, color: COLOR.subtexto })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: `Fecha: ${hoy}`, font: "Arial", size: 22, color: COLOR.subtexto })],
    }),
    version && new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: `Versión: ${version}`, font: "Arial", size: 22, color: COLOR.subtexto })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ].filter(Boolean);
}

// ─── Tabla de contenidos ────────────────────────────────────────────────────
function construirTOC() {
  return [
    new TableOfContents("Tabla de Contenidos", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ─── Header / Footer ────────────────────────────────────────────────────────
function construirHeader(spec) {
  const texto = spec.header_texto || spec.titulo || "Documento";
  return new Header({
    children: [new Paragraph({
      children: [
        new TextRun({ text: texto, font: "Arial", size: 18, color: COLOR.secundario }),
        new TextRun({ text: "\t", font: "Arial", size: 18 }),
        new TextRun({ text: new Date().toLocaleDateString("es-ES"), font: "Arial", size: 18, color: COLOR.subtexto }),
      ],
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.secundario, space: 4 } },
    })],
  });
}

function construirFooter(spec) {
  const empresa = spec.empresa || "";
  return new Footer({
    children: [new Paragraph({
      children: [
        new TextRun({ text: empresa, font: "Arial", size: 18, color: COLOR.subtexto }),
        new TextRun({ text: "\t", font: "Arial", size: 18 }),
        new TextRun({ text: "Página ", font: "Arial", size: 18, color: COLOR.subtexto }),
        new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: COLOR.primario, bold: true }),
        new TextRun({ text: " de ", font: "Arial", size: 18, color: COLOR.subtexto }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 18, color: COLOR.primario, bold: true }),
      ],
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.secundario, space: 4 } },
    })],
  });
}

// ─── Construcción principal ─────────────────────────────────────────────────
const children = [];

// 1. Portada
if (spec.portada) {
  construirPortada(spec.portada).forEach(e => children.push(e));
}

// 2. Tabla de contenidos
if (spec.tabla_contenidos) {
  construirTOC().forEach(e => children.push(e));
}

// 3. Secciones y bloques
(spec.secciones || []).forEach(seccion => {
  if (seccion.titulo) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: seccion.titulo, font: "Arial", size: 36, bold: true, color: COLOR.primario })],
    }));
  }
  (seccion.bloques || []).forEach(bloque => {
    construirBloque(bloque).forEach(e => children.push(e));
  });
});

// ─── Documento final ────────────────────────────────────────────────────────
const doc = new Document({
  styles: ESTILOS,
  numbering: NUMERACION,
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: { default: construirHeader(spec) },
    footers: { default: construirFooter(spec) },
    children,
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputFile, buffer);
  console.log(`✅ Documento generado: ${outputFile}`);
  console.log(`📄 Tamaño: ${(buffer.length / 1024).toFixed(1)} KB`);
}).catch(err => {
  console.error("❌ Error generando documento:", err.message);
  process.exit(1);
});
