import { useState, useEffect } from "react";
import { X, MapPin, Calendar, Briefcase, Clock, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  address: string;
  serviceType: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  beforePictures: string[];
  afterPictures: string[];
}

interface JobProgressGalleryProps {
  orders: Order[];
}

export function JobProgressGallery({ orders }: JobProgressGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [currentJobTitle, setCurrentJobTitle] = useState("");

  const openLightbox = (images: string[], index: number, jobTitle: string) => {
    setCurrentImages(images);
    setCurrentImageIndex(index);
    setCurrentJobTitle(jobTitle);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setCurrentImages([]);
    setCurrentImageIndex(0);
    setCurrentJobTitle("");
  };

  const goToPrevious = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : currentImages.length - 1));
  };

  const goToNext = () => {
    setCurrentImageIndex((prev) => (prev < currentImages.length - 1 ? prev + 1 : 0));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "ASSIGNED":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return CheckCircle2;
      case "IN_PROGRESS":
        return Clock;
      case "ASSIGNED":
        return Briefcase;
      default:
        return Briefcase;
    }
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, currentImageIndex, currentImages.length]);

  return (
    <>
      <div className="space-y-8">
        {orders.map((order) => {
          const StatusIcon = getStatusIcon(order.status);
          const allPictures = [...(order.beforePictures || []), ...(order.afterPictures || [])];
          
          return (
            <div
              key={order.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Job Header */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{order.orderNumber}</h3>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {order.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-base font-medium text-gray-700">{order.customerName}</p>
                    <div className="flex items-center text-sm text-gray-600 mt-2">
                      <MapPin className="h-4 w-4 mr-1" />
                      {order.address}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center px-3 py-1 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 mb-2">
                      {order.serviceType}
                    </div>
                    {order.endTime && (
                      <div className="flex items-center justify-end text-xs text-gray-500 mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(order.endTime).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pictures Section */}
              <div className="p-6">
                {/* Before Pictures */}
                {order.beforePictures && order.beforePictures.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center mb-3">
                      <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm font-semibold">
                        Before ({order.beforePictures.length})
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {order.beforePictures.map((url, index) => (
                        <button
                          key={index}
                          onClick={() => openLightbox(order.beforePictures, index, `${order.orderNumber} - Before Pictures`)}
                          className="relative group aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          <img
                            src={url}
                            alt={`Before ${index + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                            <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">
                              View
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* After Pictures */}
                {order.afterPictures && order.afterPictures.length > 0 && (
                  <div>
                    <div className="flex items-center mb-3">
                      <div className="bg-green-100 text-green-800 px-3 py-1 rounded-lg text-sm font-semibold">
                        After ({order.afterPictures.length})
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {order.afterPictures.map((url, index) => (
                        <button
                          key={index}
                          onClick={() => openLightbox(order.afterPictures, index, `${order.orderNumber} - After Pictures`)}
                          className="relative group aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-green-500 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        >
                          <img
                            src={url}
                            alt={`After ${index + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                            <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">
                              View
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                      Total: {allPictures.length} picture{allPictures.length !== 1 ? "s" : ""}
                    </span>
                    {order.startTime && order.endTime && (
                      <span className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {Math.ceil(
                          (new Date(order.endTime).getTime() - new Date(order.startTime).getTime()) / 
                          (1000 * 60 * 60 * 24)
                        )} day{Math.ceil(
                          (new Date(order.endTime).getTime() - new Date(order.startTime).getTime()) / 
                          (1000 * 60 * 60 * 24)
                        ) !== 1 ? "s" : ""} to complete
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && currentImages.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-95">
          <div className="relative w-full h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-black bg-opacity-50">
              <div className="flex items-center space-x-4">
                <h3 className="text-white text-lg font-semibold">{currentJobTitle}</h3>
                <span className="text-gray-300 text-sm">
                  {currentImageIndex + 1} / {currentImages.length}
                </span>
              </div>
              <button
                onClick={closeLightbox}
                className="text-white hover:text-gray-300 p-2 rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Image Container */}
            <div className="flex-1 flex items-center justify-center p-4">
              <img
                src={currentImages[currentImageIndex]}
                alt={`Image ${currentImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Navigation */}
            {currentImages.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-3 rounded-full transition-all"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-3 rounded-full transition-all"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Keyboard hint */}
            <div className="p-4 text-center">
              <p className="text-gray-400 text-sm">
                Use arrow keys to navigate • Press ESC to close
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
