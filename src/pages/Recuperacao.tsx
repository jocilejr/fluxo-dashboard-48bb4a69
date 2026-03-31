import { BoletoAutoRecoveryToggle } from "@/components/dashboard/BoletoAutoRecoveryToggle";
import { BoletoRecoveryDashboard } from "@/components/dashboard/BoletoRecoveryDashboard";

const Recuperacao = () => {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-bold">Recuperação de Boletos</h1>
      <BoletoAutoRecoveryToggle />
      <BoletoRecoveryDashboard />
    </div>
  );
};

export default Recuperacao;
