-- Criar trigger para executar handle_new_delivery_link automaticamente
CREATE TRIGGER on_delivery_link_created
  BEFORE INSERT ON public.delivery_link_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_delivery_link();