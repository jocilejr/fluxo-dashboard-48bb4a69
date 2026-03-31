import { BoletoRecoveryDashboard } from "@/components/dashboard/BoletoRecoveryDashboard";
import { BoletoAutoRecoveryToggle } from "@/components/dashboard/BoletoAutoRecoveryToggle";

const Recuperacao = () => {
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">Recuperação de Boletos</h1>
      <div className="space-y-6">
        <BoletoAutoRecoveryToggle />
        <BoletoRecoveryDashboard />
      </div>
    </div>
  );
};

export default Recuperacao;
