/**
 * FR-1.1: 4-Step Request Wizard
 * Step 1: Trip purpose + vehicle category (min 10 chars validation)
 * Step 2: Start/end datetime with end-before-start validation
 * Step 3: Pickup + destination locations
 * Step 4: Review & Submit
 * UI-4: All forms provide clear validation messages
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import {
  Calendar as CalendarIcon, Car, MapPin, Users, CheckCircle2,
  ChevronRight, ChevronLeft, Loader2, AlertCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { tripApi } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const BG_URL = null; // Use gradient background instead of external image

const VEHICLE_CATEGORIES = [
  { value: "sedan",     label: "Sedan" },
  { value: "suv",       label: "SUV" },
  { value: "pickup",    label: "Pickup Truck" },
  { value: "bus",       label: "Bus" },
  { value: "minibus",   label: "Mini-Bus" },
  { value: "motorcycle",label: "Motorcycle" },
  { value: "truck",     label: "Truck" },
];

// Per-step validation schemas
const step1Schema = z.object({
  purpose: z.string().min(10, "Trip purpose must be at least 10 characters"),
  vehicleCategory: z.string().min(1, "Please select a vehicle category"),
});

const step2Schema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endDate: z.string().min(1, "End date is required"),
  endTime: z.string().min(1, "End time is required"),
}).refine(data => {
  const start = new Date(`${data.startDate}T${data.startTime}`);
  const end = new Date(`${data.endDate}T${data.endTime}`);
  return end > start;
}, { message: "End date/time must be after start date/time", path: ["endTime"] });

const step3Schema = z.object({
  pickupLocation: z.string().min(3, "Pickup location is required"),
  destinationLocation: z.string().min(3, "Destination is required"),
  passengerCount: z.coerce.number().min(1, "At least 1 passenger required"),
  tripType: z.string().min(1, "Select trip type"),
});

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs font-semibold text-red-500 mt-1">
      <AlertCircle className="h-3 w-3" /> {message}
    </p>
  );
}

export default function RequestWizard() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Unified form state across all steps
  const [formData, setFormData] = useState({
    purpose: "", vehicleCategory: "",
    startDate: format(new Date(), "yyyy-MM-dd"), startTime: "08:00",
    endDate: format(new Date(), "yyyy-MM-dd"), endTime: "17:00",
    pickupLocation: "MESSOB Center HQ", pickupLatitude: 0, pickupLongitude: 0,
    destinationLocation: "", destinationLatitude: 0, destinationLongitude: 0,
    passengerCount: 1, tripType: "official",
  });

  const [errors, setErrors] = useState({});

  const update = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validateStep = (stepNum) => {
    try {
      if (stepNum === 1) step1Schema.parse(formData);
      if (stepNum === 2) step2Schema.parse(formData);
      if (stepNum === 3) step3Schema.parse(formData);
      setErrors({});
      return true;
    } catch (err) {
      const fieldErrors = {};
      err.errors?.forEach(e => { fieldErrors[e.path[0]] = e.message; });
      setErrors(fieldErrors);
      return false;
    }
  };

  const nextStep = () => {
    if (validateStep(step)) setStep(s => Math.min(s + 1, 4));
  };
  const prevStep = () => { setErrors({}); setStep(s => Math.max(s - 1, 1)); };

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const startDt = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDt = new Date(`${formData.endDate}T${formData.endTime}`);

      const payload = {
        purpose: formData.purpose,
        vehicle_category: formData.vehicleCategory,
        start_datetime: startDt.toISOString(),
        end_datetime: endDt.toISOString(),
        pickup_location: formData.pickupLocation,
        pickup_latitude: formData.pickupLatitude || 0,
        pickup_longitude: formData.pickupLongitude || 0,
        destination_location: formData.destinationLocation,
        destination_latitude: formData.destinationLatitude || 0,
        destination_longitude: formData.destinationLongitude || 0,
        passenger_count: formData.passengerCount,
        priority: "normal",
        trip_type: formData.tripType,
      };

      const res = await tripApi.create(payload);
      toast.success(`Request #${res.trip_request_id} submitted successfully!`);
      navigate("/my-requests");
    } catch (err) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = ["Basics", "Schedule", "Locations", "Review"];
  const stepIcons = [Car, CalendarIcon, MapPin, CheckCircle2];

  return (
    <div className="relative -m-4 md:-m-8 min-h-screen overflow-hidden bg-brand-blue"
      style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 40%, #1d4ed8 70%, #0f172a 100%)" }}>
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-brand-gold blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-blue-400 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full bg-white blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto py-12 px-4">
        {/* Progress Bar */}
        <div className="flex items-center justify-between my-10 relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-white/20 -translate-y-1/2 z-0" />
          <div className="absolute top-1/2 left-0 h-1 bg-brand-gold -translate-y-1/2 z-0 transition-all duration-500" style={{ width: `${((step - 1) / 3) * 100}%` }} />
          {[1, 2, 3, 4].map(item => {
            const Icon = stepIcons[item - 1];
            return (
              <div key={item} className="z-10 flex flex-col items-center">
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-black transition-all border-4 shadow-xl",
                  step >= item ? "bg-brand-gold text-brand-blue border-white scale-110" : "bg-brand-blue text-blue-200 border-blue-800")}>
                  {step > item ? <CheckCircle2 className="h-6 w-6" /> : <Icon className="h-5 w-5" />}
                </div>
                <span className={cn("text-[10px] mt-2 font-black uppercase tracking-widest hidden sm:block",
                  step >= item ? "text-white" : "text-blue-300")}>
                  {stepLabels[item - 1]}
                </span>
              </div>
            );
          })}
        </div>

        <Card className="border-none shadow-[0_30px_60px_rgba(0,0,0,0.4)] overflow-hidden rounded-[2rem]">
          <div className="bg-brand-blue p-6 text-white border-b-4 border-brand-gold">
            <h2 className="text-xl font-black tracking-tight">
              Step {step}: {["Trip Basics", "Schedule", "Locations & Passengers", "Review & Submit"][step - 1]}
            </h2>
            <p className="text-blue-100 text-sm opacity-80 mt-1">Official MESSOB vehicle request form</p>
          </div>

          <CardContent className="p-8 bg-white min-h-[320px] relative overflow-hidden">
            <div key={step} className="animate-slide-in-right">
            {/* Step 1: Purpose + Category */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <Label className="text-brand-blue font-black uppercase text-xs tracking-widest">Trip Purpose *</Label>
                  <Textarea
                    placeholder="Describe the purpose of this trip (minimum 10 characters)..."
                    value={formData.purpose}
                    onChange={e => update("purpose", e.target.value)}
                    className={cn("mt-2 rounded-xl border-2 min-h-[80px]", errors.purpose ? "border-red-400" : "border-gray-200 focus:border-brand-blue")}
                  />
                  <FieldError message={errors.purpose} />
                  <p className="text-xs text-gray-400 mt-1">{formData.purpose.length}/10 min characters</p>
                </div>
                <div>
                  <Label className="text-brand-blue font-black uppercase text-xs tracking-widest">Required Vehicle Category *</Label>
                  <Select value={formData.vehicleCategory} onValueChange={v => update("vehicleCategory", v)}>
                    <SelectTrigger className={cn("mt-2 h-12 border-2 rounded-xl font-bold", errors.vehicleCategory ? "border-red-400" : "border-gray-200")}>
                      <SelectValue placeholder="Select vehicle type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors.vehicleCategory} />
                </div>
              </div>
            )}

            {/* Step 2: Schedule with datetime validation */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-brand-blue font-black uppercase text-xs tracking-widest">Start Date *</Label>
                    <Input type="date" value={formData.startDate} onChange={e => update("startDate", e.target.value)}
                      className={cn("mt-2 h-12 border-2 rounded-xl", errors.startDate ? "border-red-400" : "border-gray-200")} />
                    <FieldError message={errors.startDate} />
                  </div>
                  <div>
                    <Label className="text-brand-blue font-black uppercase text-xs tracking-widest">Start Time *</Label>
                    <Input type="time" value={formData.startTime} onChange={e => update("startTime", e.target.value)}
                      className={cn("mt-2 h-12 border-2 rounded-xl", errors.startTime ? "border-red-400" : "border-gray-200")} />
                    <FieldError message={errors.startTime} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-brand-blue font-black uppercase text-xs tracking-widest">End Date *</Label>
                    <Input type="date" value={formData.endDate} min={formData.startDate} onChange={e => update("endDate", e.target.value)}
                      className={cn("mt-2 h-12 border-2 rounded-xl", errors.endDate ? "border-red-400" : "border-gray-200")} />
                    <FieldError message={errors.endDate} />
                  </div>
                  <div>
                    <Label className="text-brand-blue font-black uppercase text-xs tracking-widest">End Time *</Label>
                    <Input type="time" value={formData.endTime} onChange={e => update("endTime", e.target.value)}
                      className={cn("mt-2 h-12 border-2 rounded-xl", errors.endTime ? "border-red-400" : "border-gray-200")} />
                    <FieldError message={errors.endTime} />
                  </div>
                </div>
                {errors.endTime && errors.endTime.includes("after") && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" /> End date/time must be after start date/time
                  </div>
                )}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  Multi-day trips are supported. Set end date to a future date for overnight or extended trips.
                </div>
              </div>
            )}

            {/* Step 3: Locations + Passengers */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <Label className="text-brand-blue font-black uppercase text-xs tracking-widest">Pickup Location *</Label>
                  <Input value={formData.pickupLocation} onChange={e => update("pickupLocation", e.target.value)}
                    placeholder="e.g. MESSOB Center HQ, Main Gate"
                    className={cn("mt-2 h-12 border-2 rounded-xl", errors.pickupLocation ? "border-red-400" : "border-gray-200")} />
                  <FieldError message={errors.pickupLocation} />
                </div>
                <div>
                  <Label className="text-brand-blue font-black uppercase text-xs tracking-widest">Destination *</Label>
                  <Input value={formData.destinationLocation} onChange={e => update("destinationLocation", e.target.value)}
                    placeholder="e.g. Adama, Bahir Dar, Tikur Anbessa Hospital"
                    className={cn("mt-2 h-12 border-2 rounded-xl", errors.destinationLocation ? "border-red-400" : "border-gray-200")} />
                  <FieldError message={errors.destinationLocation} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-brand-blue font-black uppercase text-xs tracking-widest">Passengers *</Label>
                    <Input type="number" min="1" value={formData.passengerCount} onChange={e => update("passengerCount", parseInt(e.target.value) || 1)}
                      className={cn("mt-2 h-12 border-2 rounded-xl", errors.passengerCount ? "border-red-400" : "border-gray-200")} />
                    <FieldError message={errors.passengerCount} />
                  </div>
                  <div>
                    <Label className="text-brand-blue font-black uppercase text-xs tracking-widest">Trip Type *</Label>
                    <Select value={formData.tripType} onValueChange={v => update("tripType", v)}>
                      <SelectTrigger className="mt-2 h-12 border-2 border-gray-200 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="official">Official Business</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="personal">Personal (Authorized)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="bg-brand-blue/5 p-6 rounded-2xl border-2 border-dashed border-brand-blue/20">
                  <h3 className="font-black text-brand-blue mb-4 text-xs uppercase tracking-widest border-b border-brand-blue/10 pb-3">
                    Official Trip Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm stagger-children">
                    {[
                      ["Purpose", formData.purpose],
                      ["Vehicle Category", VEHICLE_CATEGORIES.find(c => c.value === formData.vehicleCategory)?.label || "—"],
                      ["Start", `${formData.startDate} ${formData.startTime}`],
                      ["End", `${formData.endDate} ${formData.endTime}`],
                      ["From", formData.pickupLocation],
                      ["To", formData.destinationLocation],
                      ["Passengers", formData.passengerCount],
                      ["Trip Type", formData.tripType],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-white rounded-xl p-3 border animate-fade-in-up">
                        <p className="text-xs text-gray-400 font-bold uppercase">{label}</p>
                        <p className="font-bold text-gray-800 mt-0.5 capitalize">{value || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                  <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-800 font-medium">
                    Submitting sends a formal notification to the Dispatcher for review and vehicle assignment.
                  </p>
                </div>
              </div>
            )}
          </div>
          </CardContent>

          <div className="p-6 bg-gray-50 flex justify-between items-center border-t border-gray-100">
            <Button variant="ghost" onClick={prevStep} disabled={step === 1} className="font-black text-brand-blue uppercase tracking-widest text-xs">
              <ChevronLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {step < 4 ? (
              <Button onClick={nextStep} className="bg-brand-blue hover:bg-blue-900 px-8 h-12 font-black shadow-xl rounded-2xl text-white">
                Continue <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <Button onClick={onSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700 px-8 h-12 font-black shadow-xl rounded-2xl text-white">
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : <>Submit Request <CheckCircle2 className="ml-2 h-5 w-5" /></>}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
