/**
 * In-Memory Store
 * Replace with MongoDB/PostgreSQL in production
 */



const plans = Object.freeze([
  // MONTHLY

  {
    id: "plan_trial",
    name: "45 Days Free Trial",
    slug: "trial",
    description:
      "Experience all premium features free for 45 days with no setup cost.",
    icon: "🎁",
    monthlyPrice: 0,
    yearlyPrice: 0,
    totalPrice: 0,
    currency: "INR",
    recommended: false,
    category: "monthly",
    months: 1.5,
    freeText: "FREE",
    subtitle: "Try Yo Doctor Free",
    buttonText: "Start Free Trial",
    discount: "",
    gradient: "from-emerald-500 to-green-600",
    circleColor: "bg-emerald-600",
    features: [
      { text: "Unlimited patient records", included: true },
      { text: "Appointment scheduling", included: true },
      { text: "Telemedicine integration", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "Priority support", included: true },
    ],
    //     razorpay: {
    //     monthly_plan_id: "plan_rzp_trial_monthly",
    //     yearly_plan_id: "plan_rzp_trial_yearly",
    // },
    maxUsers: null,
    maxPatients: null,
  },

  {
    id: "plan_3_month",
    name: "3 Month Plan",
    slug: "3-month",
    description:
      "Pay for only 45 days and use Yo Doctor for 3 full months.",
    icon: "🏥",
    category: "monthly",
    months: 3,
    originalPrice: 2397,
    monthlyPrice: 1199,
    totalPrice: 1199,
    currency: "INR",
    recommended: true,
    freeText: "45 DAYS FREE",
    subtitle: "Subscribe for 3 Months",
    buttonText: "Choose Plan",
    discount: "50% OFF",
    gradient: "from-emerald-500 to-green-600",
    circleColor: "bg-emerald-600",
    features: [
      { text: "Unlimited patient records", included: true },
      { text: "Appointment scheduling", included: true },
      { text: "Telemedicine integration", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "Priority support", included: true },
    ],
    razorpay: {
      monthly_plan_id: "plan_SyIGKoWJWSbIwh",
      // yearly_plan_id: "plan_SyIGKoWJWSbIwh",
    },
    maxUsers: null,
    maxPatients: null,
  },

  {
    id: "plan_6_month",
    name: "6 Month Plan",
    slug: "6-month",
    description:
      "Pay for only 3 months and get additional 3 months absolutely free.",
    icon: "⚕️",
    category: "monthly",
    months: 6,
    originalPrice: 4794,
    monthlyPrice: 2397,
    totalPrice: 2397,
    currency: "INR",
    recommended: false,
    freeText: "3 MONTHS FREE",
    subtitle: "Subscribe for 6 Months",
    buttonText: "Choose Plan",
    discount: "50% OFF",
    gradient: "from-blue-600 to-indigo-700",
    circleColor: "bg-blue-600",
    features: [
      { text: "Unlimited patient records", included: true },
      { text: "Appointment scheduling", included: true },
      { text: "Telemedicine integration", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "Priority support", included: true },
    ],
    razorpay: {
      monthly_plan_id: "plan_SyIJ1YDRxCEv4x",
      // yearly_plan_id: "plan_rzp_6_month_yearly",
    },
    maxUsers: null,
    maxPatients: null,
  },

  // YEARLY

  {
    id: "plan_1_year",
    name: "1 Year Plan",
    slug: "1-year",
    description:
      "Pay for only 8 months and get 4 months absolutely free.",
    icon: "🏨",
    category: "yearly",
    months: 12,
    originalPrice: 9588,
    yearlyPrice: 6392,
    totalPrice: 6392,
    currency: "INR",
    recommended: false,
    freeText: "4 MONTHS FREE",
    subtitle: "Subscribe for 1 Year",
    buttonText: "Choose Plan",
    discount: "33% OFF",
    gradient: "from-violet-600 to-purple-700",
    circleColor: "bg-violet-600",
    features: [
      { text: "Unlimited patient records", included: true },
      { text: "Appointment scheduling", included: true },
      { text: "Telemedicine integration", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "Priority support", included: true },
    ],
    razorpay: {
      // monthly_plan_id: "plan_rzp_1_year_monthly",
      yearly_plan_id: "plan_SyIP4sWbpbeDfA",
    },
    maxUsers: null,
    maxPatients: null,
  },

  {
    id: "plan_2_year",
    name: "2 Year Plan",
    slug: "2-year",
    description: "Best long-term subscription plan.",
    icon: "🚀",
    category: "yearly",
    months: 24,
    originalPrice: 19176,
    yearlyPrice: 15340,
    totalPrice: 15340,
    currency: "INR",
    recommended: false,
    freeText: "20% OFF",
    subtitle: "Subscribe for 2 Years",
    buttonText: "Choose Plan",
    discount: "20% OFF",
    gradient: "from-orange-500 to-red-500",
    circleColor: "bg-orange-500",
    features: [
      { text: "Unlimited patient records", included: true },
      { text: "Appointment scheduling", included: true },
      { text: "Telemedicine integration", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "Priority support", included: true },
    ],
    razorpay: {
      // monthly_plan_id: "plan_rzp_2_year_monthly",
      yearly_plan_id: "plan_SyIMaGNKF8EbwI",
    },
    maxUsers: null,
    maxPatients: null,
  },

  {
    id: "plan_3_year",
    name: "3 Year Plan",
    slug: "3-year",
    description: "Maximum savings for hospitals and clinics.",
    icon: "👑",
    category: "yearly",
    months: 36,
    originalPrice: 28764,
    yearlyPrice: 23011,
    totalPrice: 23011,
    currency: "INR",
    recommended: false,
    freeText: "20% OFF",
    subtitle: "Subscribe for 3 Years",
    buttonText: "Choose Plan",
    discount: "20% OFF",
    gradient: "from-pink-500 to-rose-600",
    circleColor: "bg-pink-600",
    features: [
      { text: "Unlimited patient records", included: true },
      { text: "Appointment scheduling", included: true },
      { text: "Telemedicine integration", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "Priority support", included: true },
    ],
        razorpay: {
        // monthly_plan_id: "plan_SyIGKoWJWSbIwh",
        yearly_plan_id: "plan_SyINA6gLxiaiEu",
    },  
    maxUsers: null,
    maxPatients: null,
  },
]);
const db = require("../config/db");
const users = new Map();


module.exports = { plans, users };