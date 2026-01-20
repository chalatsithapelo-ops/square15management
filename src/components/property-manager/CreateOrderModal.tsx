import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import { X, UserPlus } from "lucide-react";
import { OTHER_SERVICE_TYPE_VALUE, resolveServiceType } from "~/utils/serviceTypeOther";

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateOrderModal({ isOpen, onClose }: CreateOrderModalProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [selectedContractor, setSelectedContractor] = useState<string>("");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [scopeFormat, setScopeFormat] = useState<"text" | "lineItems">("text");
  const [scopeLineItems, setScopeLineItems] = useState<
    Array<{
      description: string;
      unitOfMeasure: string;
      quantity: number;
      unitPrice: number;
    }>
  >([]);

  const [formData, setFormData] = useState({
    orderNumber: "",
    title: "",
    scopeOfWork: "",
    buildingAddress: "",
    buildingName: "",
    description: "",
    totalAmount: 0,
    notes: "",
    contractorId: 0,
    companyName: "",
    companyEmail: "",
    companyPhone: "",
    contactPerson: "",
    externalContractorEmail: "",
    externalContractorName: "",
    serviceType: "",
    otherServiceType: "",
    callOutFee: 0,
    labourRate: 0,
    totalMaterialBudget: 0,
    numLabourersNeeded: 0,
    totalLabourCostBudget: 0,
  });

  const serviceTypeOptions = [
    "PLUMBING",
    "ELECTRICAL",
    "HVAC",
    "CARPENTRY",
    "PAINTING",
    "ROOFING",
    "GENERAL_MAINTENANCE",
  ] as const;

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

  const createOrderMutation = useMutation(
    trpc.createPropertyManagerOrder.mutationOptions({
      onSuccess: (data) => {
        console.log("✅ Order created successfully:", data);
        toast.success("Order created successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerOrders.queryKey(),
        });
        setFormData({
          orderNumber: "",
          title: "",
          scopeOfWork: "",
          buildingAddress: "",
          buildingName: "",
          description: "",
          totalAmount: 0,
          notes: "",
          contractorId: 0,
          companyName: "",
          companyEmail: "",
          companyPhone: "",
          contactPerson: "",
          externalContractorEmail: "",
          externalContractorName: "",
          serviceType: "",
          otherServiceType: "",
          callOutFee: 0,
          labourRate: 0,
          totalMaterialBudget: 0,
          numLabourersNeeded: 0,
          totalLabourCostBudget: 0,
        });
        setMaterials([]);
        setScopeLineItems([]);
        setScopeFormat("text");
        setSelectedContractor("");
        setSelectedBuilding("");
        onClose();
      },
      onError: (error: any) => {
        console.error("❌ Order creation error:", error);
        console.error("Error details:", {
          message: error.message,
        });
        toast.error(error.message || "Failed to create order.");
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🔍 HandleSubmit called");
    
    if (!token) {
      console.error("❌ No token found");
      toast.error("No authentication token found");
      return;
    }

    console.log("✅ Token exists:", token.substring(0, 20) + "...");

    if (!formData.title || formData.title.length < 3) {
      toast.error("Please enter a title (minimum 3 characters)");
      return;
    }

    if (scopeFormat === "text") {
      if (!formData.scopeOfWork || formData.scopeOfWork.length < 10) {
        toast.error("Please enter scope of work (minimum 10 characters)");
        return;
      }
    } else {
      if (scopeLineItems.length === 0) {
        toast.error("Please add at least one line item for scope of work");
        return;
      }
      const hasEmptyItems = scopeLineItems.some(item => !item.description || !item.unitOfMeasure);
      if (hasEmptyItems) {
        toast.error("Please fill in description and unit of measure for all line items");
        return;
      }
    }

    if (!formData.buildingAddress || formData.buildingAddress.length < 5) {
      toast.error("Please enter building address (minimum 5 characters)");
      return;
    }

    if (!formData.description || formData.description.length < 10) {
      toast.error("Please enter description (minimum 10 characters)");
      return;
    }

    const externalEmail = (useManualEntry ? formData.companyEmail : formData.externalContractorEmail).trim();
    const externalName = (useManualEntry
      ? (formData.companyName || formData.contactPerson || externalEmail)
      : (formData.externalContractorName || externalEmail)).trim();

    if (!formData.contractorId && !externalEmail) {
      toast.error("Please select a contractor or enter an external contractor email");
      return;
    }

    if (externalEmail && !externalEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    console.log("✅ All validations passed");

    const resolvedServiceType = resolveServiceType(formData.serviceType, formData.otherServiceType);

    // Generate scope of work text from line items if using that format
    const scopeOfWorkText = scopeFormat === "lineItems" 
      ? scopeLineItems.map((item, idx) => 
          `${idx + 1}. ${item.description} - ${item.quantity} ${item.unitOfMeasure} @ R${item.unitPrice.toFixed(2)} = R${(item.quantity * item.unitPrice).toFixed(2)}`
        ).join('\n') + `\n\nSubtotal: R${calculateLineItemsTotal().toFixed(2)}\nVAT (15%): R${calculateLineItemsVAT().toFixed(2)}\nTotal: R${(calculateLineItemsTotal() + calculateLineItemsVAT()).toFixed(2)}`
      : formData.scopeOfWork;

    const orderData = {
      token,
      contractorTableId: externalEmail ? undefined : (formData.contractorId || undefined), // prefer external email if provided
      externalContractorEmail: externalEmail || undefined,
      externalContractorName: externalEmail ? (externalName || externalEmail) : undefined,
      title: formData.title,
      description: formData.description,
      scopeOfWork: scopeOfWorkText,
      buildingAddress: formData.buildingAddress,
      buildingName: formData.buildingName || undefined,
      totalAmount: formData.totalAmount,
      notes: formData.notes || undefined,
      attachments: materials.length > 0 ? materials.map(m => JSON.stringify(m)) : undefined,
      serviceType: resolvedServiceType || undefined,
    };

    console.log("📦 Creating order with data:", orderData);
    console.log("🚀 Calling createOrderMutation.mutate...");

    createOrderMutation.mutate(orderData);
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
    } as typeof materials[0];
    setMaterials(updatedMaterials);
  };

  const handleContractorSelect = (contractorId: string) => {
    setSelectedContractor(contractorId);
    if (contractorId && !useManualEntry) {
      const contractor = contractors.find((c: any) => c.id === parseInt(contractorId));
      if (contractor) {
        setFormData({
          ...formData,
          contractorId: contractor.id, // Store Contractor table ID
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
          buildingAddress: building.address,
          buildingName: building.name,
        });
      }
    }
  };

  const handleAddScopeLineItem = () => {
    setScopeLineItems([
      ...scopeLineItems,
      {
        description: "",
        unitOfMeasure: "",
        quantity: 0,
        unitPrice: 0,
      },
    ]);
  };

  const handleRemoveScopeLineItem = (index: number) => {
    setScopeLineItems(scopeLineItems.filter((_, i) => i !== index));
  };

  const handleScopeLineItemChange = (
    index: number,
    field: string,
    value: any
  ) => {
    const updatedItems = [...scopeLineItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    } as typeof scopeLineItems[0];
    setScopeLineItems(updatedItems);
  };

  const calculateLineItemsTotal = () => {
    return scopeLineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const calculateLineItemsVAT = () => {
    return calculateLineItemsTotal() * 0.15;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg sm:rounded-lg max-w-full sm:max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-6 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">Create New Order</h2>
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
                    setFormData({
                      ...formData,
                      companyName: "",
                      companyEmail: "",
                      companyPhone: "",
                      contactPerson: "",
                      externalContractorEmail: "",
                      externalContractorName: "",
                    });
                  }
                }}
                className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
              >
                <UserPlus className="w-4 h-4" />
                {useManualEntry ? "Select from Database" : "Manual Entry"}
              </button>
            </div>
            
            {!useManualEntry ? (
              <>
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

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Email Order to External Contractor (Optional)
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    If provided, the order will be emailed with a secure link to accept and upload invoices without logging in.
                  </p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="email"
                      placeholder="contractor@example.com"
                      value={formData.externalContractorEmail}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData({
                          ...formData,
                          externalContractorEmail: value,
                          contractorId: value ? 0 : formData.contractorId,
                        });
                        if (value) {
                          setSelectedContractor("");
                        }
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="text"
                      placeholder="Contractor Name (optional)"
                      value={formData.externalContractorName}
                      onChange={(e) => setFormData({ ...formData, externalContractorName: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </>
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
              <input
                type="text"
                placeholder="Order Title *"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
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
                placeholder="Building Address *"
                value={formData.buildingAddress}
                onChange={(e) =>
                  setFormData({ ...formData, buildingAddress: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <select
                value={formData.serviceType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    serviceType: e.target.value,
                    otherServiceType: e.target.value === OTHER_SERVICE_TYPE_VALUE ? formData.otherServiceType : "",
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select Service Type</option>
                {serviceTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {value
                      .replace(/_/g, " ")
                      .toLowerCase()
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
                <option value={OTHER_SERVICE_TYPE_VALUE}>Other</option>
              </select>
              {formData.serviceType === OTHER_SERVICE_TYPE_VALUE && (
                <input
                  type="text"
                  value={formData.otherServiceType}
                  onChange={(e) => setFormData({ ...formData, otherServiceType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="Specify service type"
                  required
                />
              )}
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
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Scope of Work *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setScopeFormat(scopeFormat === "text" ? "lineItems" : "text");
                      if (scopeFormat === "text") {
                        setFormData({ ...formData, scopeOfWork: "" });
                      } else {
                        setScopeLineItems([]);
                      }
                    }}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    {scopeFormat === "text" ? "Switch to Line Items" : "Switch to Text"}
                  </button>
                </div>
                {scopeFormat === "text" ? (
                  <textarea
                    placeholder="Detailed work breakdown"
                    value={formData.scopeOfWork}
                    onChange={(e) =>
                      setFormData({ ...formData, scopeOfWork: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    rows={4}
                  />
                ) : (
                  <div>
                    <div className="space-y-3 mb-3">
                      {scopeLineItems.map((item, index) => (
                        <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3 bg-gray-50">
                          <input
                            type="text"
                            placeholder="Description *"
                            value={item.description}
                            onChange={(e) =>
                              handleScopeLineItemChange(index, "description", e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                          />
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <input
                              type="text"
                              placeholder="Unit of Measure *"
                              value={item.unitOfMeasure}
                              onChange={(e) =>
                                handleScopeLineItemChange(index, "unitOfMeasure", e.target.value)
                              }
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Quantity"
                              value={item.quantity}
                              onChange={(e) =>
                                handleScopeLineItemChange(
                                  index,
                                  "quantity",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Unit Price (R)"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleScopeLineItemChange(
                                  index,
                                  "unitPrice",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white"
                            />
                            <div className="text-right pt-2">
                              <p className="text-sm font-medium text-gray-700">
                                R{(item.quantity * item.unitPrice).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveScopeLineItem(index)}
                            className="w-full px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                          >
                            Remove Line Item
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddScopeLineItem}
                      className="w-full px-3 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 rounded-lg border border-teal-200"
                    >
                      + Add Line Item
                    </button>
                    {scopeLineItems.length > 0 && (
                      <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-700">Subtotal:</span>
                            <span className="font-medium">R{calculateLineItemsTotal().toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">VAT (15%):</span>
                            <span className="font-medium">R{calculateLineItemsVAT().toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-gray-300">
                            <span className="text-gray-900 font-semibold">Total:</span>
                            <span className="text-teal-600 font-bold">R{(calculateLineItemsTotal() + calculateLineItemsVAT()).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Budget Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Budget Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Order Amount (R) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.totalAmount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      totalAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
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
              disabled={createOrderMutation.isPending}
              className="flex-1 px-4 py-2 text-white bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 rounded-lg font-medium transition-colors"
            >
              {createOrderMutation.isPending ? "Creating..." : "Create Order"}
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
