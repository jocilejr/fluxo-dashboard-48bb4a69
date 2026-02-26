import { BoletoRecoveryDashboard } from "@/components/dashboard/BoletoRecoveryDashboard";

const Recuperacao = () => {
  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6">Recuperação de Boletos</h1>
      <BoletoRecoveryDashboard />
    </div>
  );
};

export default Recuperacao;
