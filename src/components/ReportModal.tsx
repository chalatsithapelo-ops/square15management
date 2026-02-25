import { useState } from "react";
import { FileSpreadsheet, FileText, X, Download, Calendar, Filter } from "lucide-react";
import { exportToExcel, exportToPDF, type ReportColumn } from "~/utils/reportExport";

interface ReportFilter {
  label: string;
  key: string;
  options: { value: string; label: string }[];
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  filenamePrefix: string;
  columns: ReportColumn[];
  data: any[];
  filters?: ReportFilter[];
  generatedBy?: string;
}

export function ReportModal({
  isOpen,
  onClose,
  title,
  filenamePrefix,
  columns,
  data,
  filters = [],
  generatedBy,
}: ReportModalProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [selectedColumns, setSelectedColumns] = useState<string[]>(columns.map((c) => c.key));

  if (!isOpen) return null;

  // Apply filters
  let filteredData = [...data];

  // Date range filter
  if (dateFrom) {
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    filteredData = filteredData.filter((row) => {
      const date = new Date(row.createdAt || row.date || row.validUntil);
      return date >= from;
    });
  }
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    filteredData = filteredData.filter((row) => {
      const date = new Date(row.createdAt || row.date || row.validUntil);
      return date <= to;
    });
  }

  // Custom filters
  Object.entries(activeFilters).forEach(([key, value]) => {
    if (value) {
      filteredData = filteredData.filter((row) => String(row[key]) === value);
    }
  });

  const activeColumns = columns.filter((c) => selectedColumns.includes(c.key));

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}_${timestamp}`;

  const filterDescription = [
    dateFrom && `From: ${new Date(dateFrom).toLocaleDateString()}`,
    dateTo && `To: ${new Date(dateTo).toLocaleDateString()}`,
    ...Object.entries(activeFilters)
      .filter(([, v]) => v)
      .map(([k, v]) => {
        const filter = filters.find((f) => f.key === k);
        const opt = filter?.options.find((o) => o.value === v);
        return `${filter?.label}: ${opt?.label || v}`;
      }),
  ]
    .filter(Boolean)
    .join(" | ");

  const handleExport = (format: "excel" | "pdf") => {
    const config = {
      title,
      subtitle: filterDescription || undefined,
      filename,
      columns: activeColumns,
      data: filteredData,
      generatedBy,
    };

    if (format === "excel") {
      exportToExcel(config);
    } else {
      exportToPDF(config);
    }
  };

  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Download className="h-5 w-5 text-indigo-600" />
              Generate Report
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Date Range */}
          <div>
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
              <Calendar className="h-4 w-4 text-indigo-500" />
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Status / Custom Filters */}
          {filters.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                <Filter className="h-4 w-4 text-indigo-500" />
                Filters
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filters.map((filter) => (
                  <div key={filter.key}>
                    <label className="text-xs text-gray-500 mb-1 block">{filter.label}</label>
                    <select
                      value={activeFilters[filter.key] || ""}
                      onChange={(e) =>
                        setActiveFilters((prev) => ({ ...prev, [filter.key]: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">All</option>
                      {filter.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Column Selection */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">
              Columns to Include
            </label>
            <div className="flex flex-wrap gap-2">
              {columns.map((col) => (
                <button
                  key={col.key}
                  onClick={() => toggleColumn(col.key)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    selectedColumns.includes(col.key)
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-medium"
                      : "bg-gray-50 border-gray-200 text-gray-500"
                  }`}
                >
                  {col.header}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Preview</span>
              <span className="text-xs text-gray-500">
                {filteredData.length} record{filteredData.length !== 1 ? "s" : ""} | {activeColumns.length} column{activeColumns.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="overflow-x-auto max-h-48 border border-gray-200 rounded-lg">
              <table className="min-w-full text-xs">
                <thead className="bg-indigo-50 sticky top-0">
                  <tr>
                    {activeColumns.map((col) => (
                      <th key={col.key} className="px-3 py-2 text-left font-semibold text-indigo-700 whitespace-nowrap">
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.slice(0, 10).map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      {activeColumns.map((col) => (
                        <td key={col.key} className="px-3 py-1.5 whitespace-nowrap text-gray-700">
                          {col.format ? col.format(row[col.key], row) : row[col.key]?.toString() || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={activeColumns.length} className="px-3 py-4 text-center text-gray-400">
                        No records match the selected filters
                      </td>
                    </tr>
                  )}
                  {filteredData.length > 10 && (
                    <tr>
                      <td colSpan={activeColumns.length} className="px-3 py-2 text-center text-gray-400 italic">
                        ... and {filteredData.length - 10} more records
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer / Export Buttons */}
        <div className="flex items-center justify-between p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => handleExport("excel")}
              disabled={filteredData.length === 0 || activeColumns.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={filteredData.length === 0 || activeColumns.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <FileText className="h-4 w-4" />
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
