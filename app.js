function normalize(text) {
    let t = text.toUpperCase();
    t = t.replace(/&AMP;/g, "&");

    t = t.replace(/CIRCUIBRK/g, "CIRCUITBRK");
    t = t.replace(/CB[-\s]*(\d+(?:[-A-Z0-9]+)?)/g, "CIRCUITBRK$1");
    t = t.replace(/CB[-\s]*(\d+)\s+([A-Z0-9-]+)/g, "CIRCUITBRK$1$2");
    t = t.replace(/CIRCUIT\s*BRK\s+(\d+(?:[-A-Z0-9]+)?)/g, "CIRCUITBRK$1");
    t = t.replace(/CIRCUITBRK\s+(\d+)\s+([A-Z0-9-]+)/g, "CIRCUITBRK$1$2");
    t = t.replace(/CIRCUITBRK\s+(\d+(?:[-A-Z0-9]+)?)/g, "CIRCUITBRK$1");
    t = t.replace(/\b#?(\d+)\s*MCM\b/g, "$1MCM");
    t = t.replace(/TRANSF(\d+)/g, "TRANSFO$1");

    return t.replace(/\s+/g, " ");
}

function breakerSize(part) {
    let match = part.match(/CIRCUITBRK(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

function partPriority(p) {
    if (p.startsWith("J-BOX")) return 0;
    if (p.startsWith("PLATE25_GFCI")) return 6;  // Group convenience outlet plate with GFCI parts
    if (p.startsWith("PLATE")) return 1;
    if (/^(CIRCUITBRK|LUG|LOCK|ROTARY|HANDLE|COVER)/.test(p)) return 2;
    if (/^(TRANSFO|MECH|MOTOR)/.test(p)) return 3;
    if (p.startsWith("BLOCK")) return 4;
    if (/^(SHAFT|FUSE)/.test(p)) return 5;
    if (/^(GFCI-OUTLET|GFCI-30MA-ALT|BOX|PLATE25)/.test(p)) return 6;
    if (/^(GROUNDBAR|BRACKET|TERMINA|TERM_COV_XT1|RING_KIT)/.test(p)) return 7;
    if (p.startsWith("WIRE")) return 8;
    return 9;
}

function findParts(text) {
    let parts = {};
    let qtyParts = new Set();

    text = text.replace(/\(\d{4}\)/g, "");
    text = text.replace(/\b\d+\s*[xX]\s*\d+\/0/g, "");
    text = text.replace(/\b\d+\s*[xX]\s*#?\d+\b/g, "");
    text = text.replace(/\b\d+\s*A\b/g, "");

    const wireMap = {
        "4/0":["WIRE_4/0"],
        "1/0":["WIRE_1/0"],
        "2":["WIRE100"],
        "4":["WIRE102"],
        "6":["WIRE101"],
        "8":["WIRE30"],
        "10":["WIRE35"],
        "12":["WIRE47"],
        "14":["WIRE29","WIRE44","WIRE45"]
    };
    const mapWireToken = (tok) => {
        tok = tok.replace(/^#/g, "");
        if (/^\d+MCM$/.test(tok)) return "WIRE_" + tok;
        if (tok === "4/0" || tok === "1/0") return tok;
        if (wireMap[tok]) return tok;
        return null;
    };
    const normalizeToken = (tok) => tok.startsWith("#") ? tok.slice(1) : tok;
    const isPartToken = (tok) => /^(J-BOX|PLATE|CIRCUITBRK|LUG|LOCK|ROTARY|HANDLE|COVER|TRANSFO|MECH|MOTOR|BLOCK|FUSE|SHAFT|BOX|GFCI-OUTLET|GFCI-30MA-ALT|PLATE25|GROUNDBAR|BRACKET|TERMINA|TERM_COV_XT1|RING_KIT)/.test(tok);
    const ignoreQtyToken = (tok) => /^(WHT|BLK|RED|GRN|YEL|ORG|BRN|PNK|H\d+)$/i.test(tok);

    let tokens = text.match(/#?\d+MCM|\(\d+\)|[A-Z0-9_\-/]+/g) || [];
    for (let i = 0; i < tokens.length; ) {
        let tok = tokens[i];

        if (/^\(\d+\)$/.test(tok)) {
            let qty = parseInt(tok.slice(1, -1), 10);
            let next = tokens[i + 1];
            let prev = tokens[i - 1];

            if (next && (isPartToken(next) || mapWireToken(next))) {
                let normalizedNext = normalizeToken(next);
                let wireKey = mapWireToken(next);
                if (wireKey) {
                    if (wireMap[wireKey]) {
                        wireMap[wireKey].forEach(w => {
                            parts[w] = (parts[w] || 0) + qty;
                        });
                    } else {
                        parts[wireKey] = (parts[wireKey] || 0) + qty;
                    }
                } else {
                    parts[next] = (parts[next] || 0) + qty;
                }
                qtyParts.add(normalizedNext);
                i += 2;
                continue;
            }

            if (prev && (isPartToken(prev) || mapWireToken(prev))) {
                let normalizedPrev = normalizeToken(prev);
                let wireKey = mapWireToken(prev);
                if (wireKey) {
                    if (wireMap[wireKey]) {
                        wireMap[wireKey].forEach(w => {
                            parts[w] = (parts[w] || 0) + qty;
                        });
                    } else {
                        parts[wireKey] = (parts[wireKey] || 0) + qty;
                    }
                } else {
                    parts[prev] = (parts[prev] || 0) + qty;
                }
                qtyParts.add(normalizedPrev);
            }
            i++;
            continue;
        }

        let normalizedTok = normalizeToken(tok);
        if (qtyParts.has(normalizedTok) || ignoreQtyToken(tok)) {
            i++;
            continue;
        }

        if (/^\d+A$/.test(tok)) {
            i++;
            continue;
        }

        let next = tokens[i + 1];
        if ((isPartToken(tok) || mapWireToken(tok)) && next && /^\(\d+\)$/.test(next)) {
            let qty = parseInt(next.slice(1, -1), 10);
            let next2 = tokens[i + 2];
            if (next2 && (isPartToken(next2) || mapWireToken(next2))) {
                let wireKey = mapWireToken(tok);
                if (wireKey) {
                    if (wireMap[wireKey]) {
                        wireMap[wireKey].forEach(w => {
                            parts[w] = (parts[w] || 0) + 1;
                        });
                    } else {
                        parts[wireKey] = (parts[wireKey] || 0) + 1;
                    }
                } else {
                    parts[tok] = (parts[tok] || 0) + 1;
                }
                i++;
                continue;
            }

            let wireKey = mapWireToken(tok);
            if (wireKey) {
                if (wireMap[wireKey]) {
                    wireMap[wireKey].forEach(w => {
                        parts[w] = (parts[w] || 0) + qty;
                    });
                } else {
                    parts[wireKey] = (parts[wireKey] || 0) + qty;
                }
            } else {
                parts[tok] = (parts[tok] || 0) + qty;
            }
            qtyParts.add(normalizedTok);
            i += 2;
            continue;
        }

        let wireKey = mapWireToken(tok);
        if (wireKey) {
            if (wireMap[wireKey]) {
                wireMap[wireKey].forEach(w => {
                    parts[w] = (parts[w] || 0) + 1;
                });
            } else {
                parts[wireKey] = (parts[wireKey] || 0) + 1;
            }
            i++;
            continue;
        }

        if (tok === "FUSE24") {
            parts[tok] = (parts[tok] || 0) + 2;
            i++;
            continue;
        }

        if (isPartToken(tok)) {
            parts[tok] = (parts[tok] || 0) + 1;
        }
        i++;
    }

    return parts;
}

function buildTable(parts) {
    let rows = [];
    let usedWires = new Set();

    for (let part in parts) {

        let row = part.startsWith("WIRE")
            ? { part, opr:120, qty:"", uom:"FT", find:5040 }
            : { part, opr:120, qty:parts[part], uom:"EA", find:5040 };

        if (part.startsWith("WIRE")) usedWires.add(part);

        row.priority = partPriority(part);
        row.breaker = breakerSize(part);

        rows.push(row);
    }

    rows.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.breaker !== b.breaker) return b.breaker - a.breaker;
        return a.part.localeCompare(b.part);
    });

    return { rows, usedWires };
}

function addWireTable(ws, usedWires) {
    const wires = [
        ["WIRE_500MCM",""],["WIRE_400MCM",""],["WIRE_350MCM",""],["WIRE_300MCM",""],["WIRE_250MCM",""],
        ["WIRE_4/0","4/0"],["WIRE_3/0","3/0"],["WIRE_2/0","2/0"],["WIRE_1/0","1/0"],
        ["WIRE103","#1"],["WIRE116","#1 Green"],["WIRE100","#2"],["WIRE107","#2 Green"],
        ["WIRE102","#4"],["WIRE109","#4 Green"],["WIRE101","#6"],["WIRE110","#6 Green"],
        ["WIRE30","#8"],["WIRE39","#8 Green"],["WIRE35","#10"],["WIRE36","#10 Green"],
        ["WIRE47","#12"],["WIRE50","#12 Green"],["WIRE106","#12 White"],
        ["WIRE29","#14 Black"],["WIRE44","#14 White"],["WIRE45","#14 Green"]
    ];

    ws.mergeCells("I5:N5");

    let header = ws.getCell("I5");
    header.value = "WIRE OPTIONS";
    header.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFFFFF00" } };
    header.alignment = { horizontal:"center" };
    header.font = { bold:true };

    wires.forEach((w,i) => {
        let row = ws.getRow(7+i);

        row.getCell(9).value = w[0];
        row.getCell(10).value = 120;
        row.getCell(11).value = "";
        row.getCell(12).value = "FT";
        row.getCell(13).value = 5040;
        row.getCell(14).value = w[1];

        if (usedWires.has(w[0])) {
            for (let c=9;c<=14;c++) {
                row.getCell(c).fill = {
                    type:"pattern",
                    pattern:"solid",
                    fgColor:{ argb:"FF00FF00" }
                };
            }
        }
    });
}

async function process() {
    try {

        const jobName = document.getElementById("jobName").value.trim();
        const boxes = [
            document.getElementById("box1").value,
            document.getElementById("box2").value,
            document.getElementById("box3").value,
            document.getElementById("box4").value
        ];

        const wb = new ExcelJS.Workbook();

        for (let i=0;i<boxes.length;i++) {

            if (!boxes[i].trim()) continue;

            let { rows, usedWires } = buildTable(findParts(normalize(boxes[i])));

            let sheetName = jobName ? `${jobName}_JBOX${i+1}` : `JBOX${i+1}`;
            let ws = wb.addWorksheet(sheetName);

            // HEADER
            let headers = ["PART","OPR","QTY","UOM","FIND"];
            headers.forEach((h,i) => {
                let cell = ws.getRow(5).getCell(i+2);
                cell.value = h;
                cell.fill = { type:"pattern", pattern:"solid", fgColor:{argb:"FF800080"} };
                cell.font = { color:{argb:"FFFFFFFF"}, bold:true };
                cell.alignment = { horizontal:"center" };
            });

            // DATA
            rows.forEach((r,idx) => {
                let row = ws.getRow(6+idx);
                row.getCell(2).value = r.part;
                row.getCell(3).value = r.opr;
                row.getCell(4).value = r.qty;
                row.getCell(5).value = r.uom;
                row.getCell(6).value = r.find;

                [3,4,5,6].forEach(c=>{
                    row.getCell(c).alignment = { horizontal:"center" };
                });
            });

            // 🔴 WARNING BOX
            ws.mergeCells("P5:S10");
            let warn = ws.getCell("P5");

            warn.value = "⚠ VERIFY WIRE QTY & UOM ⚠";
            warn.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFFF0000" } };
            warn.font = { bold:true, color:{ argb:"FF000000" }};
            warn.alignment = { horizontal:"center", vertical:"middle", wrapText:true };

            // 🟡 INFO BOX
            ws.mergeCells("P14:S17");
            let info = ws.getCell("P14");

            info.value =
                "Called out Wires are Highlighted in the\n" +
                "Wire Options table for easy reference.\n" +
                "Please verify quantities and UOMs\n" +
                "before ordering.";

            info.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFFFFF00" } };
            info.alignment = { horizontal:"center", vertical:"middle", wrapText:true };

            addWireTable(ws, usedWires);
        }

        const buffer = await wb.xlsx.writeBuffer();

        const blob = new Blob([buffer], {
            type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = jobName ? `${jobName}_parts.xlsx` : "jbox_parts.xlsx";
        if (typeof gtag === "function") {
    gtag('event', 'excel_download', {
        event_category: 'JBOX',
        event_label: jobName || 'Unnamed Job'
    });
}
        link.click();

    } catch (err) {
        console.error(err);
        alert("ERROR: " + err.message);
    }
}
