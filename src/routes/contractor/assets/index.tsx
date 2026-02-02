import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { RequireSubscriptionFeature } from "~/components/RequireSubscriptionFeature";
import {
  ArrowLeft,
  Plus,
  Search,
  Package,
  Calendar,
  DollarSign,
  MapPin,
  Edit,
} from "lucide-react";
import { AccessDenied } from "~/components/AccessDenied";

export const Route = createFileRoute("/contractor/assets/")({
  component: AssetsPageGuarded,
});

function AssetsPageGuarded() {
  return (
    <RequireSubscriptionFeature feature="hasAssets" returnPath="/contractor/dashboard">
      <AssetsPage />
    </RequireSubscriptionFeature>
  );
}

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
        setShowAddForm(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create asset");
      },
    })
  );

  const updateAssetMutation = useMutation(
    trpc.updateAsset.mutationOptions({
      onSuccess: () => {
        toast.success("Asset updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getAssets.queryKey() });
        setEditingAsset(null);
        setEditValues({});
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
  
  // Show loading state while data is being fetched
  if (assetsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading assets...</p>
        </div>
      </div>
    );
  }
  
  const filteredAssets = assets.filter((asset) =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (asset.serialNumber && asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalValue = assets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
  const safeTotalValue = Number(totalValue) || 0;
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
                to="/contractor/dashboard"
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
                  {assets.length} assets • R{safeTotalValue.toLocaleString()} total value
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

              <div className="md:col-span-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    reset();
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((asset) => (
            <div key={asset.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{asset.name}</h3>
                  <p className="text-sm text-gray-600">{asset.category}</p>
                </div>
                <button
                  onClick={() => {
                    if (editingAsset === asset.id) {
                      handleEditSave(asset.id);
                    } else {
                      setEditingAsset(asset.id);
                      setEditValues({
                        currentValue: asset.currentValue,
                        condition: asset.condition,
                        location: asset.location,
                      });
                    }
                  }}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Edit className="h-5 w-5" />
                </button>
              </div>

              {asset.description && (
                <p className="text-sm text-gray-600 mb-3">{asset.description}</p>
              )}

              <div className="space-y-2 text-sm">
                {asset.serialNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Serial:</span>
                    <span className="font-medium text-gray-900">{asset.serialNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Purchase Price:</span>
                  <span className="font-medium text-gray-900">R{asset.purchasePrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Current Value:</span>
                  {editingAsset === asset.id ? (
                    <input
                      type="number"
                      value={editValues.currentValue || asset.currentValue}
                      onChange={(e) => setEditValues({ ...editValues, currentValue: parseFloat(e.target.value) })}
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                    />
                  ) : (
                    <span className="font-medium text-gray-900">R{asset.currentValue.toLocaleString()}</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Condition:</span>
                  {editingAsset === asset.id ? (
                    <select
                      value={editValues.condition || asset.condition}
                      onChange={(e) => setEditValues({ ...editValues, condition: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      {assetConditions.map((cond) => (
                        <option key={cond} value={cond}>
                          {cond}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-medium text-gray-900">{asset.condition}</span>
                  )}
                </div>
                {(asset.location || editingAsset === asset.id) && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      Location:
                    </span>
                    {editingAsset === asset.id ? (
                      <input
                        type="text"
                        value={editValues.location || asset.location || ""}
                        onChange={(e) => setEditValues({ ...editValues, location: e.target.value })}
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{asset.location}</span>
                    )}
                  </div>
                )}
                <div className="flex justify-between text-xs text-gray-500">
                  <span className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    Purchased
                  </span>
                  <span>{new Date(asset.purchaseDate).toLocaleDateString()}</span>
                </div>
              </div>

              {editingAsset === asset.id && (
                <div className="mt-4 pt-4 border-t flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setEditingAsset(null);
                      setEditValues({});
                    }}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleEditSave(asset.id)}
                    disabled={updateAssetMutation.isPending}
                    className="px-3 py-1 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50"
                  >
                    {updateAssetMutation.isPending ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredAssets.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No assets found</p>
          </div>
        )}
      </main>
    </div>
  );
}
