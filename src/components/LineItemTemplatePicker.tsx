import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import toast from "react-hot-toast";
import { Search, Plus, X, BookOpen, Trash2 } from "lucide-react";

export interface TemplateLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitOfMeasure: string;
}

interface LineItemTemplatePickerProps {
  token: string;
  onInsert: (item: TemplateLineItem) => void;
  /** Allow managers to create / delete templates inline */
  canManage?: boolean;
}

/**
 * Compact dropdown UI for selecting a saved line-item template and inserting it
 * into a quotation/invoice form. Also lets managers add new templates inline.
 */
export function LineItemTemplatePicker({ token, onInsert, canManage = true }: LineItemTemplatePickerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("Sum");
  const [category, setCategory] = useState("");

  const templatesQuery = useQuery(trpc.getLineItemTemplates.queryOptions({ token }));
  const templates = templatesQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t: any) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q)
    );
  }, [templates, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of filtered) {
      const key = t.category || "Uncategorised";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const createMutation = useMutation(
    trpc.createLineItemTemplate.mutationOptions({
      onSuccess: () => {
        toast.success("Template saved");
        queryClient.invalidateQueries({ queryKey: trpc.getLineItemTemplates.queryKey() });
        setShowAdd(false);
        setName("");
        setDescription("");
        setUnitPrice("");
        setCategory("");
      },
      onError: (err) => toast.error(err.message || "Failed to save template"),
    })
  );

  const deleteMutation = useMutation(
    trpc.deleteLineItemTemplate.mutationOptions({
      onSuccess: () => {
        toast.success("Template deleted");
        queryClient.invalidateQueries({ queryKey: trpc.getLineItemTemplates.queryKey() });
      },
      onError: (err) => toast.error(err.message || "Failed to delete template"),
    })
  );

  const handleInsert = (t: any) => {
    onInsert({
      description: t.description,
      quantity: 1,
      unitPrice: t.unitPrice,
      total: t.unitPrice,
      unitOfMeasure: t.unitOfMeasure,
    });
    toast.success(`Inserted "${t.name}"`);
  };

  const handleSaveTemplate = () => {
    if (!name.trim() || !description.trim() || !unitPrice) {
      toast.error("Name, description and price are required");
      return;
    }
    createMutation.mutate({
      token,
      name: name.trim(),
      description: description.trim(),
      unitPrice: Number(unitPrice),
      unitOfMeasure,
      category: category.trim() || undefined,
    });
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
        title="Insert from saved line-item templates"
      >
        <BookOpen className="h-3.5 w-3.5 mr-1" />
        Templates
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-96 bg-white border border-gray-200 rounded-lg shadow-xl">
          <div className="p-2 border-b border-gray-100 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <input
              autoFocus
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none"
            />
            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {templatesQuery.isLoading ? (
              <div className="px-3 py-6 text-center text-sm text-gray-500">Loading...</div>
            ) : grouped.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-gray-500">No templates yet</div>
            ) : (
              grouped.map(([cat, items]) => (
                <div key={cat}>
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50">{cat}</div>
                  {items.map((t: any) => (
                    <div
                      key={t.id}
                      className="px-3 py-2 hover:bg-purple-50 flex items-center gap-2 group"
                    >
                      <button
                        type="button"
                        onClick={() => handleInsert(t)}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm font-medium text-gray-900">{t.name}</div>
                        <div className="text-xs text-gray-600 line-clamp-1">{t.description}</div>
                        <div className="text-xs text-purple-700 font-semibold mt-0.5">
                          R {Number(t.unitPrice).toLocaleString()} / {t.unitOfMeasure}
                        </div>
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete template "${t.name}"?`)) {
                              deleteMutation.mutate({ token, id: t.id });
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {canManage && (
            <div className="border-t border-gray-100 p-2">
              {!showAdd ? (
                <button
                  type="button"
                  onClick={() => setShowAdd(true)}
                  className="w-full inline-flex items-center justify-center px-2 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50 rounded"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Save new template
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Template name (e.g. Geyser replacement 150L)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded"
                  />
                  <textarea
                    placeholder="Description (will appear on the line item)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      placeholder="Price"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      className="px-2 py-1.5 text-sm border border-gray-200 rounded"
                    />
                    <select
                      value={unitOfMeasure}
                      onChange={(e) => setUnitOfMeasure(e.target.value)}
                      className="px-2 py-1.5 text-sm border border-gray-200 rounded"
                    >
                      <option value="Sum">Sum</option>
                      <option value="m2">m2</option>
                      <option value="Lm">Lm</option>
                      <option value="m3">m3</option>
                      <option value="Hr">Hr</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="px-2 py-1.5 text-sm border border-gray-200 rounded"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      disabled={createMutation.isPending}
                      className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50"
                    >
                      Save template
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAdd(false)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
