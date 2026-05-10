import { useState, useMemo, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import toast from "react-hot-toast";
import {
  X,
  Search,
  FileText,
  Shield,
  ClipboardList,
  AlertTriangle,
  Award,
  Loader2,
  CheckCircle2,
  Download,
  Eye,
  Edit,
  Sparkles,
} from "lucide-react";
import {
  OHS_TEMPLATES,
  OHS_TEMPLATE_CATEGORIES,
  type OhsTemplate,
  substitutePlaceholders,
  extractPlaceholders,
} from "~/data/ohsTemplates";

function downloadBase64Pdf(b64: string, filename: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Friendly labels for known placeholders
const PLACEHOLDER_LABELS: Record<string, { label: string; hint?: string }> = {
  "{{COMPANY_NAME}}": { label: "Company name", hint: "Your registered company name" },
  "{{COMPANY_REG_NO}}": { label: "Company registration number" },
  "{{COMPANY_ADDRESS}}": { label: "Company physical address" },
  "{{CLIENT_NAME}}": { label: "Client name", hint: "Name of the client this document is for" },
  "{{SITE_NAME}}": { label: "Site / project name" },
  "{{SITE_ADDRESS}}": { label: "Site address" },
  "{{PROJECT_NAME}}": { label: "Project name" },
  "{{CEO_NAME}}": { label: "CEO / accountable person name" },
  "{{CEO_TITLE}}": { label: "CEO / accountable person title" },
  "{{SAFETY_OFFICER_NAME}}": { label: "Safety officer name" },
  "{{SAFETY_OFFICER_CONTACT}}": { label: "Safety officer contact (cell)" },
  "{{FIRST_AIDER_NAME}}": { label: "First aider name" },
  "{{FIRE_MARSHAL_NAME}}": { label: "Fire marshal name" },
  "{{EFFECTIVE_DATE}}": { label: "Effective date" },
  "{{REVIEW_DATE}}": { label: "Next review date" },
  "{{EMERGENCY_NUMBER}}": { label: "Site emergency phone number" },
};

function iconForType(type: string) {
  switch (type) {
    case "POLICY": return Shield;
    case "PROCEDURE": return FileText;
    case "CHECKLIST": return ClipboardList;
    case "EMERGENCY_PLAN": return AlertTriangle;
    case "LEGAL_APPOINTMENT": return Award;
    default: return FileText;
  }
}

// ============================================================================
// Template Picker Modal
// ============================================================================
interface PickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (template: OhsTemplate) => void;
}

export function OhsTemplatePicker({ open, onClose, onPick }: PickerProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return OHS_TEMPLATES.filter((t) => {
      if (filterType !== "ALL" && t.type !== filterType) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [search, filterType]);

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  OHS Document Templates
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  SA OHS Act 85 of 1993 & Construction Regulations 2014 aligned. Pick a template,
                  fill in client/site details, then edit any section.
                </p>
              </div>
              <button onClick={onClose}><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 border-b flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates…"
                  className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="ALL">All types ({OHS_TEMPLATES.length})</option>
                {OHS_TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c.type} value={c.type}>
                    {c.label} ({c.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-y-auto p-4 space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No templates match your search.</div>
              ) : (
                filtered.map((t) => {
                  const Icon = iconForType(t.type);
                  return (
                    <button
                      key={t.id}
                      onClick={() => onPick(t)}
                      className="w-full text-left bg-white border rounded-lg p-4 hover:border-amber-500 hover:shadow-md transition flex items-start gap-3"
                    >
                      <div className="p-2 rounded-lg bg-amber-50 flex-shrink-0">
                        <Icon className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-gray-900">{t.title}</span>
                          <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            {t.category}
                          </span>
                          {t.requiresAck && (
                            <span className="text-[10px] uppercase tracking-wide text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                              Requires ack
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{t.description}</p>
                        {t.legalBasis.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            <span className="font-medium">Legal basis:</span> {t.legalBasis.join(" • ")}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}

// ============================================================================
// Markdown-ish preview renderer (matches PDF rendering rules)
// ============================================================================
function renderPreview(content: string) {
  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let listBuf: string[] = [];
  let listType: "ul" | "check" | null = null;

  const flushList = (key: string) => {
    if (listBuf.length === 0) return;
    if (listType === "ul") {
      elements.push(
        <ul key={key} className="list-disc ml-6 my-2 space-y-1 text-sm">
          {listBuf.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      );
    } else if (listType === "check") {
      elements.push(
        <ul key={key} className="ml-2 my-2 space-y-1 text-sm">
          {listBuf.map((l, i) => {
            const checked = l.startsWith("[x]");
            const text = l.replace(/^\[[ x]\]\s*/, "");
            return (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-0.5 inline-block w-4 h-4 border ${checked ? "bg-amber-600 border-amber-600 text-white text-xs flex items-center justify-center" : "border-gray-400"}`}>
                  {checked && "✓"}
                </span>
                <span>{text}</span>
              </li>
            );
          })}
        </ul>
      );
    }
    listBuf = [];
    listType = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.replace(/\s+$/g, "");
    const key = `l${idx}`;

    if (line.startsWith("# ")) {
      flushList(key + "-fl");
      elements.push(<h1 key={key} className="text-2xl font-bold mt-4 mb-2 text-gray-900">{line.slice(2)}</h1>);
    } else if (line.startsWith("## ")) {
      flushList(key + "-fl");
      elements.push(<h2 key={key} className="text-lg font-semibold mt-4 mb-1 text-amber-700 border-b border-amber-200 pb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      flushList(key + "-fl");
      elements.push(<h3 key={key} className="text-base font-semibold mt-3 mb-1 text-gray-800">{line.slice(4)}</h3>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (listType !== "ul") { flushList(key + "-fl"); listType = "ul"; }
      listBuf.push(line.slice(2));
    } else if (/^\[[ x]\]/.test(line)) {
      if (listType !== "check") { flushList(key + "-fl"); listType = "check"; }
      listBuf.push(line);
    } else if (line.startsWith("|")) {
      // simple table row - render as monospace line for now
      flushList(key + "-fl");
      elements.push(<div key={key} className="font-mono text-xs whitespace-pre">{line}</div>);
    } else if (line.trim() === "") {
      flushList(key + "-fl");
      elements.push(<div key={key} className="h-2" />);
    } else {
      flushList(key + "-fl");
      // bold **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <p key={key} className="text-sm text-gray-800 my-1 leading-relaxed">
          {parts.map((p, i) =>
            p.startsWith("**") && p.endsWith("**")
              ? <strong key={i}>{p.slice(2, -2)}</strong>
              : <span key={i}>{p}</span>
          )}
        </p>
      );
    }
  });
  flushList("final");

  return elements;
}

// ============================================================================
// Main Document Editor Modal
// ============================================================================
interface EditorProps {
  token: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  // Edit mode
  existing?: {
    id: number;
    type: string;
    title: string;
    version: string;
    content: string;
    requiresAck: boolean;
    reviewDate?: string | null;
    status: string;
  };
  // Template mode
  template?: OhsTemplate;
}

export function OhsDocumentEditor({ token, open, onClose, onSaved, existing, template }: EditorProps) {
  const trpc = useTRPC();
  const isEdit = !!existing;

  const initialContent = existing?.content ?? template?.content ?? "";
  const initialType = existing?.type ?? template?.type ?? "POLICY";
  const initialTitle = existing?.title ?? template?.title ?? "";
  const initialRequiresAck = existing?.requiresAck ?? template?.requiresAck ?? false;

  const [type, setType] = useState<string>(initialType);
  const [title, setTitle] = useState(initialTitle);
  const [version, setVersion] = useState(existing?.version ?? "1.0");
  const [content, setContent] = useState(initialContent);
  const [requiresAck, setRequiresAck] = useState(initialRequiresAck);
  const [reviewDate, setReviewDate] = useState(existing?.reviewDate ? existing.reviewDate.slice(0, 10) : "");
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"placeholders" | "edit" | "preview">(template ? "placeholders" : "edit");

  // Detect remaining placeholders
  const remaining = useMemo(() => extractPlaceholders(content), [content]);

  // Substituted content (for preview & save)
  const substitutedContent = useMemo(
    () => substitutePlaceholders(content, placeholders),
    [content, placeholders]
  );

  const create = useMutation(trpc.ohsCreateDocument.mutationOptions({
    onSuccess: () => { toast.success("Document saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  }));
  const update = useMutation(trpc.ohsUpdateDocument.mutationOptions({
    onSuccess: () => { toast.success("Document updated"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  }));
  const exportPdf = useMutation(trpc.ohsExportDocumentPdf.mutationOptions({
    onSuccess: (res: any) => downloadBase64Pdf(res.pdf, res.filename),
    onError: (e: any) => toast.error(e.message),
  }));

  const handleApplyPlaceholders = () => {
    setContent(substitutedContent);
    setPlaceholders({});
    setTab("edit");
    toast.success("Placeholders filled in. You can now edit any section.");
  };

  const handleSave = (publish: boolean) => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!substitutedContent.trim() || substitutedContent.length < 50) {
      toast.error("Content is required");
      return;
    }
    if (isEdit) {
      update.mutate({
        token,
        documentId: existing!.id,
        title,
        version,
        content: substitutedContent,
        status: publish ? "PUBLISHED" : "DRAFT",
        reviewDate: reviewDate || undefined,
        requiresAck,
      });
    } else {
      create.mutate({
        token,
        type: type as any,
        title,
        version,
        content: substitutedContent,
        requiresAck,
        reviewDate: reviewDate || undefined,
        publish,
      });
    }
  };

  const handleExportNow = async () => {
    if (!isEdit) {
      toast.error("Save the document first before exporting.");
      return;
    }
    exportPdf.mutate({ token, documentId: existing!.id });
  };

  // Toolbar helpers
  const insertAtCursor = (snippet: string) => {
    const el = document.getElementById("ohs-editor-textarea") as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = content.slice(0, start) + snippet + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + snippet.length;
    });
  };

  const TYPES = [
    "POLICY", "PROCEDURE", "SAFE_WORK_METHOD", "RISK_ASSESSMENT", "EMERGENCY_PLAN",
    "TOOLBOX_TALK", "CHECKLIST", "MSDS", "PERMIT", "TRAINING_MATERIAL", "LEGAL_APPOINTMENT", "OTHER",
  ];

  const isSaving = create.isPending || update.isPending;

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/50" />
        <div className="fixed inset-0 flex items-center justify-center p-2">
          <Dialog.Panel className="bg-white rounded-lg w-full max-w-6xl h-[95vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold">
                  {isEdit ? "Edit OHS Document" : template ? `New from template: ${template.title}` : "New OHS Document"}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      disabled={isEdit}
                      className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-100"
                    >
                      {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full border rounded px-2 py-1.5 text-sm"
                      placeholder="Document title"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Version</label>
                    <input
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      className="w-full border rounded px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b flex gap-1">
              {template && (
                <button
                  onClick={() => setTab("placeholders")}
                  className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "placeholders" ? "border-amber-600 text-amber-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}
                >
                  1. Client / Site Details
                  {remaining.length > 0 && tab !== "placeholders" && (
                    <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{remaining.length}</span>
                  )}
                </button>
              )}
              <button
                onClick={() => setTab("edit")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "edit" ? "border-amber-600 text-amber-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}
              >
                <Edit className="w-4 h-4 inline-block mr-1.5" />
                {template ? "2. Edit Content" : "Edit Content"}
              </button>
              <button
                onClick={() => setTab("preview")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "preview" ? "border-amber-600 text-amber-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}
              >
                <Eye className="w-4 h-4 inline-block mr-1.5" />
                Preview
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden">
              {/* Placeholders */}
              {tab === "placeholders" && (
                <div className="h-full overflow-y-auto p-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-amber-900">
                      Fill in the details below — they replace every <code className="px-1 bg-white rounded text-xs">{`{{PLACEHOLDER}}`}</code> in
                      the document. You can leave any field blank and edit the text directly in the next step.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {remaining.map((ph) => {
                      const meta = PLACEHOLDER_LABELS[ph] ?? { label: ph };
                      const isDate = ph.includes("DATE");
                      return (
                        <div key={ph}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {meta.label}
                            <span className="ml-2 text-xs text-gray-400 font-mono">{ph}</span>
                          </label>
                          <input
                            type={isDate ? "date" : "text"}
                            value={placeholders[ph] ?? ""}
                            onChange={(e) => setPlaceholders({ ...placeholders, [ph]: e.target.value })}
                            className="w-full border rounded px-3 py-2 text-sm"
                            placeholder={meta.hint || ""}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 flex gap-2 sticky bottom-0 bg-white pt-3 border-t">
                    <button
                      onClick={handleApplyPlaceholders}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Apply &amp; continue to editor
                    </button>
                    <button onClick={() => setTab("edit")} className="px-4 py-2 border rounded-lg">
                      Skip — edit manually
                    </button>
                  </div>
                </div>
              )}

              {/* Edit */}
              {tab === "edit" && (
                <div className="h-full flex flex-col">
                  <div className="px-6 py-2 border-b flex flex-wrap gap-1 bg-gray-50 text-xs">
                    <button onClick={() => insertAtCursor("\n## Section heading\n")} className="px-2 py-1 bg-white border rounded hover:bg-gray-100">H2</button>
                    <button onClick={() => insertAtCursor("\n### Subsection\n")} className="px-2 py-1 bg-white border rounded hover:bg-gray-100">H3</button>
                    <button onClick={() => insertAtCursor("\n- List item\n")} className="px-2 py-1 bg-white border rounded hover:bg-gray-100">• List</button>
                    <button onClick={() => insertAtCursor("\n[ ] Checklist item\n")} className="px-2 py-1 bg-white border rounded hover:bg-gray-100">☐ Check</button>
                    <button onClick={() => insertAtCursor("**bold**")} className="px-2 py-1 bg-white border rounded hover:bg-gray-100 font-bold">B</button>
                    <button onClick={() => insertAtCursor("\n\n_______________________\nSignature\n")} className="px-2 py-1 bg-white border rounded hover:bg-gray-100">Sig line</button>
                    <span className="ml-auto text-gray-500 self-center">
                      {remaining.length > 0 && (
                        <span className="text-amber-700">⚠ {remaining.length} placeholder(s) remaining</span>
                      )}
                    </span>
                  </div>
                  <textarea
                    id="ohs-editor-textarea"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="flex-1 w-full p-6 font-mono text-[13px] leading-relaxed focus:outline-none resize-none"
                    spellCheck
                  />
                </div>
              )}

              {/* Preview */}
              {tab === "preview" && (
                <div className="h-full overflow-y-auto">
                  <div className="max-w-3xl mx-auto p-8 bg-white">
                    {renderPreview(substitutedContent)}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t bg-gray-50 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requiresAck}
                  onChange={(e) => setRequiresAck(e.target.checked)}
                />
                Requires worker acknowledgement
              </label>
              <div>
                <label className="text-sm mr-2">Next review:</label>
                <input
                  type="date"
                  value={reviewDate}
                  onChange={(e) => setReviewDate(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                />
              </div>
              <div className="ml-auto flex gap-2">
                {isEdit && (
                  <button
                    onClick={handleExportNow}
                    disabled={exportPdf.isPending}
                    className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2 hover:bg-gray-100"
                  >
                    {exportPdf.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Export PDF
                  </button>
                )}
                <button onClick={onClose} className="px-3 py-2 border rounded-lg text-sm">Cancel</button>
                <button
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                  className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-100"
                >
                  Save draft
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-amber-700"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isEdit ? "Save & Publish" : "Publish"}
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}
