import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  User, Mail, Phone, Briefcase, MapPin, Wrench, FileText,
  Loader2, CheckCircle, ArrowRight, ArrowLeft, Send,
  Car, Hammer, Shield,
} from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/apply/")({
  component: ApplyPage,
});

const TRADES = [
  "Plumber", "Electrician", "Painter", "Carpenter", "Tiler",
  "Roofer", "Bricklayer", "Plasterer", "Glazier", "Locksmith",
  "Welder", "HVAC Technician", "General Maintenance", "Landscaper",
  "Waterproofer", "Pest Control", "Flooring Specialist", "Other",
];

const PROVINCES = [
  "Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape",
  "Free State", "Limpopo", "Mpumalanga", "North West", "Northern Cape",
];

const AVAILABILITY = ["Immediately", "1 week", "2 weeks", "1 month", "Negotiable"];

const STORAGE_KEY = "sqr15_apply_form";
const STEP_KEY = "sqr15_apply_step";

function loadSavedForm() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return null;
}

function loadSavedStep() {
  try {
    const saved = localStorage.getItem(STEP_KEY);
    if (saved) return Math.min(3, Math.max(1, parseInt(saved, 10) || 1));
  } catch { /* ignore */ }
  return 1;
}

const defaultForm = {
  firstName: "", lastName: "", email: "", phone: "",
  idNumber: "", dateOfBirth: "", gender: "",
  city: "", province: "", address: "",
  primaryTrade: "", secondaryTrades: [] as string[],
  yearsExperience: "",
  qualifications: "",
  currentEmployer: "",
  availability: "",
  expectedSalary: "",
  hasOwnTools: false, hasDriversLicense: false, hasOwnTransport: false,
  motivationLetter: "",
};

function ApplyPage() {
  const navigate = useNavigate();
  const [step, setStepRaw] = useState(() => loadSavedStep());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [accessToken, setAccessToken] = useState("");

  const [form, setForm] = useState(() => ({ ...defaultForm, ...loadSavedForm() }));

  // Persist form to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(form)); } catch { /* ignore */ }
  }, [form]);

  // Persist step
  const setStep = useCallback((s: number) => {
    setStepRaw(s);
    try { localStorage.setItem(STEP_KEY, String(s)); } catch { /* ignore */ }
  }, []);

  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const toggleSecondaryTrade = (trade: string) => {
    setForm((p) => ({
      ...p,
      secondaryTrades: p.secondaryTrades.includes(trade)
        ? p.secondaryTrades.filter((t) => t !== trade)
        : [...p.secondaryTrades, trade],
    }));
  };

  const validateStep = () => {
    if (step === 1) {
      if (!form.firstName.trim() || !form.lastName.trim()) { toast.error("First and last name are required"); return false; }
      if (!form.email.trim() || !form.email.includes("@")) { toast.error("Valid email is required"); return false; }
      if (!form.phone.trim() || form.phone.length < 7) { toast.error("Phone number is required"); return false; }
    }
    if (step === 2) {
      if (!form.primaryTrade) { toast.error("Please select your primary trade"); return false; }
      if (!form.yearsExperience || parseInt(form.yearsExperience) < 0) { toast.error("Years of experience is required"); return false; }
    }
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const baseUrl = window.location.origin;
      const res = await fetch(`${baseUrl}/api/artisan/apply/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          yearsExperience: parseInt(form.yearsExperience) || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAccessToken(data.accessToken);
        setSubmitted(true);
        toast.success("Application submitted!");
        // Clear saved form data
        try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STEP_KEY); } catch { /* ignore */ }
      } else {
        toast.error(data.errors?.join(", ") || data.error || "Submission failed");
      }
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white border border-gray-200 rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Application Submitted!</h1>
          <p className="mt-2 text-gray-600">
            Thank you, {form.firstName}. We've sent an assessment link to <strong>{form.email}</strong>.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Complete 4 psychometric tests and an AI interview to be considered.
          </p>
          <button
            onClick={() => navigate({ to: "/apply/assessments/$token", params: { token: accessToken } })}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
          >
            Start Assessments Now <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-gray-50 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Join Our Team</h1>
          <p className="mt-2 text-gray-600">
            Square 15 Management — Artisan Application
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step >= s ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-500"
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${step > s ? "bg-teal-600" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8">
          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-teal-600" /> Personal Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input type="text" value={form.firstName} onChange={(e) => set("firstName", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="e.g. Sipho" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input type="text" value={form.lastName} onChange={(e) => set("lastName", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="e.g. Mokoena" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail className="w-3.5 h-3.5 inline mr-1" /> Email *
                  </label>
                  <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="sipho@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone className="w-3.5 h-3.5 inline mr-1" /> Phone *
                  </label>
                  <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="072 123 4567" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                  <input type="text" value={form.idNumber} onChange={(e) => set("idNumber", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select value={form.gender} onChange={(e) => set("gender", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500">
                  <option value="">Prefer not to say</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin className="w-3.5 h-3.5 inline mr-1" /> City
                  </label>
                  <input type="text" value={form.city} onChange={(e) => set("city", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="e.g. Johannesburg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                  <select value={form.province} onChange={(e) => set("province", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500">
                    <option value="">Select province</option>
                    {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input type="text" value={form.address} onChange={(e) => set("address", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="Optional" />
              </div>
            </div>
          )}

          {/* Step 2: Professional Info */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-teal-600" /> Professional Details
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Trade *</label>
                <select value={form.primaryTrade} onChange={(e) => set("primaryTrade", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500">
                  <option value="">Select your primary trade</option>
                  {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Trades</label>
                <div className="flex flex-wrap gap-2">
                  {TRADES.filter((t) => t !== form.primaryTrade).map((t) => (
                    <button key={t} type="button" onClick={() => toggleSecondaryTrade(t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        form.secondaryTrades.includes(t)
                          ? "bg-teal-100 text-teal-800 border border-teal-300"
                          : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience *</label>
                  <input type="number" min="0" max="50" value={form.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="e.g. 5" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
                  <select value={form.availability} onChange={(e) => set("availability", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500">
                    <option value="">Select availability</option>
                    {AVAILABILITY.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualifications / Certifications</label>
                <input type="text" value={form.qualifications} onChange={(e) => set("qualifications", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500"
                  placeholder="e.g. Trade Test Certificate, N3 Electrical" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Employer</label>
                  <input type="text" value={form.currentEmployer} onChange={(e) => set("currentEmployer", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Salary</label>
                  <input type="text" value={form.expectedSalary} onChange={(e) => set("expectedSalary", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500" placeholder="e.g. R15,000/month" />
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.hasOwnTools} onChange={(e) => set("hasOwnTools", e.target.checked)}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  <span className="text-sm text-gray-700 flex items-center gap-1"><Hammer className="w-3.5 h-3.5" /> I have my own tools</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.hasDriversLicense} onChange={(e) => set("hasDriversLicense", e.target.checked)}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  <span className="text-sm text-gray-700 flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> I have a valid driver's license</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.hasOwnTransport} onChange={(e) => set("hasOwnTransport", e.target.checked)}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  <span className="text-sm text-gray-700 flex items-center gap-1"><Car className="w-3.5 h-3.5" /> I have my own transport</span>
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Motivation */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" /> Tell Us About Yourself
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Why do you want to join Square 15?
                </label>
                <textarea value={form.motivationLetter} onChange={(e) => set("motivationLetter", e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-teal-500"
                  placeholder="Tell us about your experience, your work ethic, and why you'd be a great fit for our team..." />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <h3 className="font-semibold text-gray-800">Application Summary</h3>
                <div className="grid grid-cols-2 gap-1 text-gray-600">
                  <span>Name:</span><span className="font-medium">{form.firstName} {form.lastName}</span>
                  <span>Email:</span><span className="font-medium">{form.email}</span>
                  <span>Phone:</span><span className="font-medium">{form.phone}</span>
                  <span>Trade:</span><span className="font-medium">{form.primaryTrade}</span>
                  <span>Experience:</span><span className="font-medium">{form.yearsExperience} years</span>
                  <span>Location:</span><span className="font-medium">{form.city}{form.province ? `, ${form.province}` : ""}</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <p>After submitting, you'll be asked to complete:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-blue-600">
                  <li>IQ Assessment (30 min)</li>
                  <li>EQ Assessment (25 min)</li>
                  <li>MBTI Personality Type (15 min)</li>
                  <li>Big Five Personality (15 min)</li>
                  <li>AI Behavioural Interview (45 min)</li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}
            {step < 3 ? (
              <button type="button" onClick={() => { if (validateStep()) setStep(step + 1); }}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors">
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><Send className="w-4 h-4" /> Submit Application</>}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Square 15 Management • Artisan Recruitment Portal
        </p>
      </div>
    </div>
  );
}
