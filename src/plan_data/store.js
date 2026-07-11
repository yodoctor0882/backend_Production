/**
 * In-Memory Store
 * Replace with MongoDB/PostgreSQL in production
 */



const plans = Object.freeze([
  // MONTHLY
{
  id: "plan_trial",
  name: "45 Days Trial Plan",
  slug: "trial",
  description:
    "Get full Premium access for 45 days with a one-time ₹1 introductory charge. No automatic renewal. Upgrade anytime after your trial ends.",
  icon: "🎁",
  originalPrice: 1,
  monthlyPrice: 1,
  totalPrice: 1,
  currency: "INR",
  recommended: false,
  category: "monthly",
  months: 1.5,
  freeText: "₹1",
  subtitle: "Premium Trial Access",
  buttonText: "Start Trial",
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
  razorpay: {
    monthly_plan_id: "plan_T6BiGa4YzmKLa7",
  },
  maxUsers: null,
  maxPatients: null,
},

  {
    id: "plan_3_month",
    name: "3 Month Plan",
    slug: "3-month",
    description:
      "Get 1.5 months FREE. Pay for only 1.5 months and enjoy 3 months of Premium access.",
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
      monthly_plan_id: "plan_T6BlGdsOh4ELbW",
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
      "Get 3 months FREE. Pay for only 3 months and enjoy 6 months of YoDoctor Premium access.",
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
      monthly_plan_id: "plan_T6BmA9Jd2Pp9N9",
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
      "Get 4 months FREE. Pay for only 8 months and enjoy 12 months of YoDoctor Premium access.",
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
      yearly_plan_id: "plan_T6Bnhpp5eOIz5f",
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
      yearly_plan_id: "plan_T6BoglchsAYo6g",
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
        yearly_plan_id: "plan_T6BpNvDw35UGSf",
    },  
    maxUsers: null,
    maxPatients: null,
  },
]);
const db = require("../config/db");
const users = new Map();


module.exports = { plans, users };