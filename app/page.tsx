import InvestmentDashboard from "@/components/investment-dashboard";
import { AIAccessProvider } from "@/components/ai-access";

export default function Home() {
  return <AIAccessProvider><InvestmentDashboard /></AIAccessProvider>;
}
