import { ExpenseSlipUpload } from "~/components/ExpenseSlipUpload";
import { Info, FileText, Upload } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

export default function ExpenseUpload() {
  const [uploadedSlips, setUploadedSlips] = useState<any[]>([]);

  const handleSlipsUploaded = (slips: any[]) => {
    setUploadedSlips(slips);
    toast.success("Expense slips uploaded successfully!");
  };

  return (
    <div className="space-y-6">
      {/* Information Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">About Expense Upload</h3>
            <p className="text-sm text-blue-700 mb-3">
              Upload expense documentation such as receipts, invoices, and payment slips. 
              Our AI will help categorize your expenses automatically.
            </p>
            <ul className="text-sm text-blue-600 space-y-1 list-disc list-inside">
              <li>Supported formats: Images (JPG, PNG) and PDF documents</li>
              <li>AI-powered automatic categorization</li>
              <li>Optional manual category override</li>
              <li>Add amounts and descriptions for better tracking</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Upload Component */}
      <ExpenseSlipUpload
        onSlipsUploaded={handleSlipsUploaded}
        minimumSlips={1}
        title="Upload Expense Documentation"
        description="Upload receipts, invoices, or other expense documentation for record keeping"
      />

      {/* Recently Uploaded Summary */}
      {uploadedSlips.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Recently Uploaded</h3>
          </div>
          <div className="space-y-3">
            {uploadedSlips.map((slip, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Upload className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {slip.category.replace(/_/g, ' ')}
                    </p>
                    {slip.description && (
                      <p className="text-xs text-gray-600">{slip.description}</p>
                    )}
                  </div>
                </div>
                {slip.amount && (
                  <span className="text-sm font-semibold text-gray-900">
                    R {slip.amount.toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Best Practices</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <strong>1. Clear Images:</strong> Ensure receipts and documents are clearly visible and well-lit.
          </p>
          <p>
            <strong>2. Complete Information:</strong> Include amounts and descriptions for accurate record keeping.
          </p>
          <p>
            <strong>3. Timely Upload:</strong> Upload expenses as soon as possible after they occur.
          </p>
          <p>
            <strong>4. Proper Categorization:</strong> Review AI suggestions and correct if needed to ensure accurate expense tracking.
          </p>
        </div>
      </div>
    </div>
  );
}
