import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import Services from "@/pages/Services";
import BookingPage from "@/pages/BookingPage";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import Bookings from "@/pages/Bookings";
import BookingDetail from "@/pages/BookingDetail";
import PaymentPage from "@/pages/PaymentPage";
import InvoicePage from "@/pages/InvoicePage";
import AdminPanel from "@/pages/AdminPanel";
import AdminServices from "@/pages/AdminServices";
import AdminApplicants from "@/pages/AdminApplicants";
import AdminApplicantDetail from "@/pages/AdminApplicantDetail";
import AdminStaff from "@/pages/AdminStaff";
import AdminReschedules from "@/pages/AdminReschedules";
import AdminContactMessages from "@/pages/AdminContactMessages";
import AdminPlans from "@/pages/AdminPlans";
import AdminSettings from "@/pages/AdminSettings";
import StaffDashboard from "@/pages/StaffDashboard";
import StaffAvailability from "@/pages/StaffAvailability";
import StaffPayslips from "@/pages/StaffPayslips";
import AdminPayroll from "@/pages/AdminPayroll";
import ChangePassword from "@/pages/ChangePassword";
import Careers from "@/pages/Careers";
import ReviewPage from "@/pages/ReviewPage";
import ContactPage from "@/pages/ContactPage";
import MyPlans from "@/pages/MyPlans";
import NotFound from "@/pages/NotFound";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function App() {
  const { loading, user } = useAuth();
  const [location, setLocation] = useLocation();
  const isAdminRoute = location.startsWith("/admin");
  const isStaffRoute = location.startsWith("/staff");

  useEffect(() => {
    if (!loading && user?.user_metadata?.must_change_password && location !== "/change-password") setLocation("/change-password");
  }, [loading, user, location, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.png" alt="MakeMeClean" className="w-12 h-12 rounded-2xl"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <ScrollToTop />
      {!isAdminRoute && !isStaffRoute && <Navbar />}
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/services" component={Services} />
          <Route path="/book/:serviceId?" component={BookingPage} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/profile" component={Profile} />
          <Route path="/bookings" component={Bookings} />
          <Route path="/bookings/:id" component={BookingDetail} />
          <Route path="/pay/:bookingId" component={PaymentPage} />
          <Route path="/invoice/:bookingId" component={InvoicePage} />
          <Route path="/contact" component={ContactPage} />
          <Route path="/plans" component={MyPlans} />
          <Route path="/admin" component={AdminPanel} />
          <Route path="/admin/services" component={AdminServices} />
          <Route path="/admin/applicants/:id" component={AdminApplicantDetail} />
          <Route path="/admin/applicants" component={AdminApplicants} />
          <Route path="/admin/staff" component={AdminStaff} />
          <Route path="/admin/reschedules" component={AdminReschedules} />
          <Route path="/admin/plans" component={AdminPlans} />
          <Route path="/admin/messages" component={AdminContactMessages} />
          <Route path="/admin/settings" component={AdminSettings} />
          <Route path="/staff" component={StaffDashboard} />
          <Route path="/staff/availability" component={StaffAvailability} />
          <Route path="/staff/payslips" component={StaffPayslips} />
          <Route path="/admin/payroll" component={AdminPayroll} />
          <Route path="/change-password" component={ChangePassword} />
          <Route path="/careers" component={Careers} />
          <Route path="/review/:bookingId" component={ReviewPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
      {!isAdminRoute && !isStaffRoute && <Footer />}
    </div>
  );
}

export default App;
