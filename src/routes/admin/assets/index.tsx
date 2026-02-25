import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Plus,
  Search,
  Package,
  Calendar,
  DollarSign,
  MapPin,
  Edit,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { AccessDenied } from "~/components/AccessDenied";
import { PhotoUpload } from "~/components/PhotoUpload";

export const Route = createFileRoute("/admin/assets/")({
  component: AssetsPage,
});

const assetSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().min(1, "Purchase date is required"),
  purchasePrice: z.number().min(0, "Purchase price must be positive"),
  currentValue: z.number().min(0, "Current value must be positive"),
  condition: z.string().min(1, "Condition is required"),
  location: z.string().optional(),
  notes: z.string().optional(),
});

type AssetForm = z.infer<typeof assetSchema>;

const assetCategories = [
  "Tools",
  "Equipment",
  "Vehicles",
  "Machinery",
  "Electronics",
  "Furniture",
  "Other",
];

const assetConditions = ["Excellent", "Good", "Fair", "Poor", "Needs Repair"];

function AssetsPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Check user permissions
  const userPermissionsQuery = useQuery(
    trpc.getUserPermissions.queryOptions({
      token: token!,
    })
  );

  const userPermissions = userPermissionsQuery.data?.permissions || [];
  const hasViewAssets = userPermissions.includes("VIEW_ASSETS");

  // Show loading state while checking permissions
  if (userPermissionsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show access denied if user doesn't have permission
  if (!hasViewAssets) {
    return <AccessDenied message="You do not have permission to access Assets." />;
  }

  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [assetImages, setAssetImages] = useState<string[]>([]);

  const assetsQuery = useQuery(
    trpc.getAssets.queryOptions({
      token: token!,
      category: categoryFilter || undefined,
    })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<AssetForm>({
    resolver: zodResolver(assetSchema),
  });

  const createAssetMutation = useMutation(
    trpc.createAsset.mutationOptions({
      onSuccess: () => {
        toast.success("Asset created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getAssets.queryKey() });
        reset();
        setAssetImages([]);
        setShowAddForm(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create asset");
      },
    })
  );

  const updateAssetMutation = useMutation(
    trpc.updateAsset.mutationOptions({
      onSuccess: (data) => {
        toast.success("Asset updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getAssets.queryKey() });
        setEditingAsset(null);
        setEditValues({});
        if (selectedAsset) {
          setSelectedAsset({ ...selectedAsset, ...editValues, ...(data || {}) });
        }
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update asset");
      },
    })
  );

  const onSubmit = (data: AssetForm) => {
    createAssetMutation.mutate({
      token: token!,
      ...data,
      images: assetImages,
    });
  };

  const handleEditSave = (assetId: number) => {
    updateAssetMutation.mutate({
      token: token!,
      assetId,
      ...editValues,
    });
  };

  const assets = assetsQuery.data || [];
  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (asset.serialNumber && asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalValue = assets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const categoryStats = assetCategories.map((category) => ({
    category,
    count: assets.filter((a) => a.category === category).length,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Link
                to="/admin/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-2 rounded-xl shadow-md">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Asset Management</h1>
                <p className="text-sm text-gray-600">
                  {assets.length} assets • R{totalValue.toLocaleString()} total value
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md transition-all"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Asset
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Assets by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {categoryStats.map((stat) => (
              <div
                key={stat.category}
                className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => setCategoryFilter(categoryFilter === stat.category ? null : stat.category)}
              >
                <div className="text-2xl font-bold text-gray-900 mb-1">{stat.count}</div>
                <div className="text-xs text-gray-600">{stat.category}</div>
              </div>
            ))}
          </div>
        </div>

        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Asset</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name *</label>
                <input
                  type="text"
                  {...register("name")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Drill Machine"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  {...register("category")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select category</option>
                  {assetCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                <input
                  type="text"
                  {...register("serialNumber")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="SN123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
                <select
                  {...register("condition")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select condition</option>
                  {assetConditions.map((cond) => (
                    <option key={cond} value={cond}>
                      {cond}
                    </option>
                  ))}
                </select>
                {errors.condition && <p className="mt-1 text-sm text-red-600">{errors.condition.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date *</label>
                <input
                  type="date"
                  {...register("purchaseDate")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.purchaseDate && <p className="mt-1 text-sm text-red-600">{errors.purchaseDate.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price (R) *</label>
                <input
                  type="number"
                  {...register("purchasePrice", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="5000"
                />
                {errors.purchasePrice && <p className="mt-1 text-sm text-red-600">{errors.purchasePrice.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Value (R) *</label>
                <input
                  type="number"
                  {...register("currentValue", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="4000"
                />
                {errors.currentValue && <p className="mt-1 text-sm text-red-600">{errors.currentValue.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  {...register("location")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Warehouse A"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  {...register("description")}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Asset description..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  {...register("notes")}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Additional notes..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Images (optional)</label>
                <PhotoUpload
                  onPhotosUploaded={(urls) => setAssetImages(urls)}
                  minimumPhotos={0}
                  title="Upload Asset Images"
                  description="Upload photos of this asset"
                  initialUrls={assetImages}
                />
              </div>

              <div className="md:col-span-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    reset();
                    setAssetImages([]);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAssetMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {createAssetMutation.isPending ? "Creating..." : "Create Asset"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search assets by name, category, or serial number..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Serial #</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Purchase Price</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Current Value</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Condition</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Location</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Purchased</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedAsset(asset)}
                        className="text-left"
                      >
                        <div className="font-medium text-blue-600 cursor-pointer hover:underline">{asset.name}</div>
                      </button>
                      {asset.description && <div className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate">{asset.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{asset.category}</td>
                    <td className="px-4 py-3 text-gray-600">{asset.serialNumber || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">R{(asset.purchasePrice || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {editingAsset === asset.id ? (
                        <input
                          type="number"
                          value={editValues.currentValue || asset.currentValue}
                          onChange={(e) => setEditValues({ ...editValues, currentValue: parseFloat(e.target.value) })}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                        />
                      ) : (
                        <span className="font-medium text-gray-900">R{(asset.currentValue || 0).toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingAsset === asset.id ? (
                        <select
                          value={editValues.condition || asset.condition}
                          onChange={(e) => setEditValues({ ...editValues, condition: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          {assetConditions.map((cond) => (
                            <option key={cond} value={cond}>{cond}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          asset.condition === "NEW" ? "bg-green-100 text-green-700" :
                          asset.condition === "GOOD" ? "bg-blue-100 text-blue-700" :
                          asset.condition === "FAIR" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }`}>{asset.condition}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingAsset === asset.id ? (
                        <input
                          type="text"
                          value={editValues.location || asset.location || ""}
                          onChange={(e) => setEditValues({ ...editValues, location: e.target.value })}
                          className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        <span className="text-gray-600">{asset.location || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{new Date(asset.purchaseDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-center">
                      {editingAsset === asset.id ? (
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => { setEditingAsset(null); setEditValues({}); }}
                            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleEditSave(asset.id)}
                            disabled={updateAssetMutation.isPending}
                            className="px-2 py-1 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50"
                          >
                            {updateAssetMutation.isPending ? "..." : "Save"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingAsset(asset.id);
                            setEditValues({
                              currentValue: asset.currentValue,
                              condition: asset.condition,
                              location: asset.location,
                            });
                          }}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredAssets.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No assets found</p>
          </div>
        )}
      </main>

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedAsset(null)} />
          <div className="relative min-h-screen flex items-start justify-center p-4 pt-10">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Package className="h-6 w-6 text-white" />
                  <h2 className="text-xl font-bold text-white">{selectedAsset.name}</h2>
                </div>
                <button
                  onClick={() => setSelectedAsset(null)}
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 max-h-[80vh] overflow-y-auto">
                {/* Images Gallery */}
                {selectedAsset.images && selectedAsset.images.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" /> Photos
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {selectedAsset.images.map((img: string, idx: number) => (
                        <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                          <img src={img} alt={`Asset photo ${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Core Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <DetailItem label="Name" value={selectedAsset.name} />
                  <DetailItem label="Category" value={selectedAsset.category} />
                  <DetailItem label="Serial Number" value={selectedAsset.serialNumber || "—"} />
                  <DetailItem label="Condition" value={selectedAsset.condition} badge />
                  <DetailItem label="Location" value={selectedAsset.location || "—"} />
                  <DetailItem label="Purchase Date" value={new Date(selectedAsset.purchaseDate).toLocaleDateString()} />
                  <DetailItem label="Purchase Price" value={`R${(selectedAsset.purchasePrice || 0).toLocaleString()}`} />
                  <DetailItem label="Current Value" value={`R${(selectedAsset.currentValue || 0).toLocaleString()}`} />
                </div>

                {selectedAsset.description && (
                  <div className="mb-6">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</label>
                    <p className="mt-1 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selectedAsset.description}</p>
                  </div>
                )}

                {/* SARS Depreciation */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> SARS Depreciation
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4">
                    <DetailItem label="Useful Life (Years)" value={selectedAsset.usefulLifeYears != null ? String(selectedAsset.usefulLifeYears) : "—"} />
                    <DetailItem label="Residual Value" value={selectedAsset.residualValue != null ? `R${Number(selectedAsset.residualValue).toLocaleString()}` : "—"} />
                    <DetailItem label="Depreciation Method" value={selectedAsset.depreciationMethod || "—"} />
                    <DetailItem label="SARS Wear & Tear Rate" value={selectedAsset.sarsWearAndTearRate != null ? `${selectedAsset.sarsWearAndTearRate}%` : "—"} />
                    <DetailItem label="Accumulated Depreciation" value={selectedAsset.accumulatedDepreciation != null ? `R${Number(selectedAsset.accumulatedDepreciation).toLocaleString()}` : "—"} />
                  </div>
                </div>

                {/* Notes */}
                {selectedAsset.notes && (
                  <div className="mb-6">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</label>
                    <p className="mt-1 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedAsset.notes}</p>
                  </div>
                )}

                {/* Upload More Images */}
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" /> Add / Update Photos
                  </h3>
                  <PhotoUpload
                    onPhotosUploaded={(urls) => {
                      updateAssetMutation.mutate({
                        token: token!,
                        assetId: selectedAsset.id,
                        images: urls,
                      });
                      setSelectedAsset({ ...selectedAsset, images: urls });
                    }}
                    minimumPhotos={0}
                    title=""
                    description="Upload photos of this asset"
                    initialUrls={selectedAsset.images || []}
                  />
                </div>

                {/* Close Button */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setSelectedAsset(null)}
                    className="px-5 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Small helper for the detail modal */
function DetailItem({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      {badge ? (
        <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
          value === "Excellent" || value === "NEW" ? "bg-green-100 text-green-700" :
          value === "Good" || value === "GOOD" ? "bg-blue-100 text-blue-700" :
          value === "Fair" || value === "FAIR" ? "bg-yellow-100 text-yellow-700" :
          "bg-red-100 text-red-700"
        }`}>{value}</span>
      ) : (
        <p className="mt-1 text-sm font-medium text-gray-900">{value}</p>
      )}
    </div>
  );
}
