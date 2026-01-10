import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import { X, UserPlus } from "lucide-react";

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any | null;
}

export function EditOrderModal({ isOpen, onClose, order }: EditOrderModalProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedContractor, setSelectedContractor] = useState<string>("");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");
  const [useManualEntry, setUseManualEntry] = useState(false);

  const [formData, setFormData] = useState({
    orderNumber: "",
    companyName: "",
    companyEmail: "",
    companyPhone: "",
    contactPerson: "",
    address: "",
    serviceType: "",
    description: "",
    callOutFee: 0,
    labourRate: 0,
    totalMaterialBudget: 0,
    numLabourersNeeded: 0,
    totalLabourCostBudget: 0,
    notes: "",
  });

  // Fetch contractors
  const contractorsQuery = useQuery({
    ...trpc.getContractors.queryOptions({ token: token! }),
    enabled: !!token,
  });

  // Fetch buildings
  const buildingsQuery = useQuery({
    ...trpc.getBuildings.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const contractors = (contractorsQuery.data as any)?.contractors || [];
  const buildings = buildingsQuery.data || [];

  const [materials, setMaterials] = useState<
    Array<{
      name: string;
      description: string;
      quantity: number;
      unitPrice: number;
      supplier: string;
    }>
  >([]);

  // Populate form when order is loaded
  useEffect(() => {
    if (order) {
      setFormData({
        orderNumber: order.orderNumber || "",
        companyName: order.companyName || "",
        companyEmail: order.companyEmail || "",
        companyPhone: order.companyPhone || "",
        contactPerson: order.contactPerson || "",
        address: order.buildingAddress || order.address || "",
        serviceType: order.serviceType || "",
        description: order.description || "",
        callOutFee: order.callOutFee || 0,
        labourRate: order.labourRate || 0,
        totalMaterialBudget: order.totalMaterialBudget || 0,
        numLabourersNeeded: order.numLabourersNeeded || 0,
        totalLabourCostBudget: order.totalLabourCostBudget || 0,
        notes: order.notes || "",
      });
      
      // Load materials if they exist
      if (order.materials && Array.isArray(order.materials)) {
        setMaterials(order.materials);
      } else {
        setMaterials([]);
      }

      // Set manual entry if contractor info exists
      if (order.companyName) {
        setUseManualEntry(true);
      }
    }
  }, [order]);

  const updateOrderMutation = useMutation(
    trpc.updatePropertyManagerOrder.mutationOptions({
      onSuccess: () => {
        toast.success("Order updated and submitted successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerOrders.queryKey(),
        });
        setFormData({
          orderNumber: "",
          companyName: "",
          companyEmail: "",
          companyPhone: "",
          contactPerson: "",
          address: "",
          serviceType: "",
          description: "",
          callOutFee: 0,
          labourRate: 0,
          totalMaterialBudget: 0,
          numLabourersNeeded: 0,
          totalLabourCostBudget: 0,
          notes: "",
        });
        setMaterials([]);
        onClose();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update order.");
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !order) {
      toast.error("No authentication token found");
      return;
    }

    if (!formData.address || !formData.description) {
      toast.error("Please fill in address and description");
      return;
    }

    // Validate contractor info only if not using manual entry
    if (!useManualEntry && !formData.companyName) {
      toast.error("Please select a contractor or use manual entry");
      return;
    }

    updateOrderMutation.mutate({
      token,
      orderId: order.id,
      ...formData,
      materials: materials.length > 0 ? materials : undefined,
      status: "SUBMITTED", // Submit when editing
    });
  };

  const handleAddMaterial = () => {
    setMaterials([
      ...materials,
      {
        name: "",
        description: "",
        quantity: 0,
        unitPrice: 0,
        supplier: "",
      },
    ]);
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const handleMaterialChange = (
    index: number,
    field: string,
    value: any
  ) => {
    const updatedMaterials = [...materials];
    updatedMaterials[index] = {
      ...updatedMaterials[index],
      [field]: value,
    };
    setMaterials(updatedMaterials);
  };

  const handleContractorSelect = (contractorId: string) => {
    setSelectedContractor(contractorId);
    if (contractorId && !useManualEntry) {
      const contractor = contractors.find((c: any) => c.id === parseInt(contractorId));
      if (contractor) {
        setFormData({
          ...formData,
          companyName: contractor.companyName || `${contractor.firstName} ${contractor.lastName}`,
          companyEmail: contractor.email,
          companyPhone: contractor.phone,
          contactPerson: `${contractor.firstName} ${contractor.lastName}`,
        });
      }
    }
  };

  const handleBuildingSelect = (buildingId: string) => {
    setSelectedBuilding(buildingId);
    if (buildingId) {
      const building = buildings.find((b: any) => b.id === parseInt(buildingId));
      if (building) {
        setFormData({
          ...formData,
          address: building.address,
        });
      }
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg sm:rounded-lg max-w-full sm:max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-6 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Edit Order & Submit</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 sm:w-6 h-5 sm:h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          {/* Contractor Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Contractor</h3>
              <button
                type="button"
                onClick={() => {
                  setUseManualEntry(!useManualEntry);
                  if (!useManualEntry) {
                    setSelectedContractor("");
                    setFormData({ ...formData, companyName: "", companyEmail: "", companyPhone: "", contactPerson: "" });
                  }
                }}
                className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
              >
                <UserPlus className="w-4 h-4" />
                {useManualEntry ? "Select from Database" : "Manual Entry"}
              </button>
            </div>
            
            {!useManualEntry ? (
              <select
                value={selectedContractor}
                onChange={(e) => handleContractorSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select Contractor</option>
                {contractors.map((contractor: any) => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.companyName || `${contractor.firstName} ${contractor.lastName}`} - {contractor.serviceType}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Company Name"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="email"
                  placeholder="Company Email"
                  value={formData.companyEmail}
                  onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="tel"
                  placeholder="Company Phone"
                  value={formData.companyPhone}
                  onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
                <input
                  type="text"
                  placeholder="Contact Person"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}
          </div>

          {/* Order Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Order Number (optional - auto-generated)"
              value={formData.orderNumber}
              onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Work Details */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Work Details
            </h3>
            <div className="space-y-4">
              {/* Building Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Building/Property
                </label>
                <select
                  value={selectedBuilding}
                  onChange={(e) => handleBuildingSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select Building (Optional)</option>
                  {buildings.map((building: any) => (
                    <option key={building.id} value={building.id}>
                      {building.name} - {building.address}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                placeholder="Address *"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <select
                value={formData.serviceType}
                onChange={(e) =>
                  setFormData({ ...formData, serviceType: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select Service Type</option>
                <option value="PLUMBING">Plumbing</option>
                <option value="ELECTRICAL">Electrical</option>
                <option value="HVAC">HVAC</option>
                <option value="CARPENTRY">Carpentry</option>
                <option value="PAINTING">Painting</option>
                <option value="ROOFING">Roofing</option>
                <option value="GENERAL_MAINTENANCE">General Maintenance</option>
              </select>
              <textarea
                placeholder="Description of work *"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                rows={3}
              />
            </div>
          </div>

          {/* Budget Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Budget Information <span className="text-sm text-gray-500 font-normal">(Optional)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Call Out Fee (R)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.callOutFee}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      callOutFee: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Labour Rate (R/hour)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.labourRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      labourRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Material Budget (R)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.totalMaterialBudget}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      totalMaterialBudget: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Labourers Needed
                </label>
                <input
                  type="number"
                  value={formData.numLabourersNeeded}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      numLabourersNeeded: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Labour Cost Budget (R)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.totalLabourCostBudget}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      totalLabourCostBudget: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Materials */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Materials (Optional)
              </h3>
              <button
                type="button"
                onClick={handleAddMaterial}
                className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
              >
                + Add Material
              </button>
            </div>
            <div className="space-y-3">
              {materials.map((material, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Material Name"
                      value={material.name}
                      onChange={(e) =>
                        handleMaterialChange(index, "name", e.target.value)
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="text"
                      placeholder="Supplier"
                      value={material.supplier}
                      onChange={(e) =>
                        handleMaterialChange(index, "supplier", e.target.value)
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Description"
                    value={material.description}
                    onChange={(e) =>
                      handleMaterialChange(index, "description", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Quantity"
                      value={material.quantity}
                      onChange={(e) =>
                        handleMaterialChange(
                          index,
                          "quantity",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Unit Price (R)"
                      value={material.unitPrice}
                      onChange={(e) =>
                        handleMaterialChange(
                          index,
                          "unitPrice",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <div className="text-right pt-2">
                      <p className="text-sm font-medium text-gray-700">
                        Total: R
                        {(material.quantity * material.unitPrice).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMaterial(index)}
                    className="w-full px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                  >
                    Remove Material
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              rows={3}
              placeholder="Any additional notes or special requirements..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={updateOrderMutation.isPending}
              className="flex-1 px-4 py-2 text-white bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 rounded-lg font-medium transition-colors"
            >
              {updateOrderMutation.isPending ? "Updating..." : "Update & Submit Order"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
