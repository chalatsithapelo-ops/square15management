import { Star, MessageSquare, Award, Clock, ThumbsUp } from "lucide-react";

interface Review {
  id: number;
  createdAt: string | Date;
  rating: number;
  comment: string | null;
  serviceQuality: number | null;
  professionalism: number | null;
  timeliness: number | null;
  customer: {
    id: number;
    firstName: string;
    lastName: string;
  };
  order: {
    id: number;
    orderNumber: string;
    serviceType: string;
  } | null;
  project: {
    id: number;
    name: string;
    projectNumber: string;
  } | null;
}

interface ReviewsSectionProps {
  reviews: Review[];
  stats: {
    totalReviews: number;
    avgRating: number;
    avgServiceQuality: number;
    avgProfessionalism: number;
    avgTimeliness: number;
  };
}

export function ReviewsSection({ reviews, stats }: ReviewsSectionProps) {
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Overall Rating</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.avgRating.toFixed(1)}
              </p>
              {renderStars(stats.avgRating)}
            </div>
            <div className="bg-yellow-100 rounded-lg p-3">
              <Star className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Based on {stats.totalReviews} reviews
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Service Quality</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.avgServiceQuality.toFixed(1)}
              </p>
              {renderStars(stats.avgServiceQuality)}
            </div>
            <div className="bg-blue-100 rounded-lg p-3">
              <Award className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Professionalism</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.avgProfessionalism.toFixed(1)}
              </p>
              {renderStars(stats.avgProfessionalism)}
            </div>
            <div className="bg-green-100 rounded-lg p-3">
              <ThumbsUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Timeliness</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.avgTimeliness.toFixed(1)}
              </p>
              {renderStars(stats.avgTimeliness)}
            </div>
            <div className="bg-purple-100 rounded-lg p-3">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
            Customer Reviews
          </h3>
        </div>
        <div className="divide-y divide-gray-200">
          {reviews.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-gray-600">No reviews yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Complete jobs to receive customer feedback
              </p>
            </div>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900">
                      {review.customer.firstName} {review.customer.lastName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {review.order
                        ? `${review.order.orderNumber} - ${review.order.serviceType}`
                        : review.project
                        ? `${review.project.projectNumber} - ${review.project.name}`
                        : "General Review"}
                    </p>
                  </div>
                  <div className="text-right">
                    {renderStars(review.rating)}
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {review.comment && (
                  <p className="text-sm text-gray-700 mb-3">{review.comment}</p>
                )}

                {(review.serviceQuality || review.professionalism || review.timeliness) && (
                  <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-gray-100">
                    {review.serviceQuality && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Service Quality</p>
                        {renderStars(review.serviceQuality)}
                      </div>
                    )}
                    {review.professionalism && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Professionalism</p>
                        {renderStars(review.professionalism)}
                      </div>
                    )}
                    {review.timeliness && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Timeliness</p>
                        {renderStars(review.timeliness)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
