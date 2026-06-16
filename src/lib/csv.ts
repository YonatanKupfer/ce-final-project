type CsvValue = string | number | boolean | null | undefined;

function formatCsvValue(value: CsvValue): string {
    if (value === null || value === undefined) return "";
    return String(value).replace(/"/g, '""');
}

export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]) {
    const lines = [
        headers,
        ...rows,
    ].map((row) => row.map((value) => `"${formatCsvValue(value)}"`).join(","));

    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
        type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
