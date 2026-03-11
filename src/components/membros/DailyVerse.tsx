import { useMemo } from "react";
import { BookOpen } from "lucide-react";

const VERSES = [
  { text: "O Senhor é o meu pastor, nada me faltará.", ref: "Salmos 23:1" },
  { text: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13" },
  { text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.", ref: "João 3:16" },
  { text: "O Senhor é a minha luz e a minha salvação; a quem temerei?", ref: "Salmos 27:1" },
  { text: "Confie no Senhor de todo o seu coração e não se apoie na sua própria inteligência.", ref: "Provérbios 3:5" },
  { text: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.", ref: "Salmos 46:1" },
  { text: "Busquem, pois, em primeiro lugar o Reino de Deus e a sua justiça.", ref: "Mateus 6:33" },
  { text: "Clama a mim, e responder-te-ei, e anunciar-te-ei coisas grandes e firmes.", ref: "Jeremias 33:3" },
  { text: "Porque eu bem sei os pensamentos que tenho a vosso respeito, diz o Senhor; pensamentos de paz.", ref: "Jeremias 29:11" },
  { text: "O amor é paciente, o amor é bondoso. Não inveja, não se vangloria, não se orgulha.", ref: "1 Coríntios 13:4" },
  { text: "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.", ref: "Salmos 37:5" },
  { text: "Ainda que eu andasse pelo vale da sombra da morte, não temeria mal algum.", ref: "Salmos 23:4" },
  { text: "O Senhor é bom, um refúgio em tempos de angústia. Ele cuida dos que nele confiam.", ref: "Naum 1:7" },
  { text: "Mas os que esperam no Senhor renovarão as forças, subirão com asas como águias.", ref: "Isaías 40:31" },
  { text: "A paz vos deixo, a minha paz vos dou; não vo-la dou como o mundo a dá.", ref: "João 14:27" },
  { text: "Lança o teu cuidado sobre o Senhor, e ele te susterá.", ref: "Salmos 55:22" },
  { text: "Eu sou o caminho, a verdade e a vida.", ref: "João 14:6" },
  { text: "Pois onde estiver o vosso tesouro, aí estará também o vosso coração.", ref: "Mateus 6:21" },
  { text: "Não temas, porque eu sou contigo; não te assombres, porque eu sou teu Deus.", ref: "Isaías 41:10" },
  { text: "Em tudo dai graças, porque esta é a vontade de Deus em Cristo Jesus para convosco.", ref: "1 Tessalonicenses 5:18" },
  { text: "Sede fortes e corajosos. Não temais, nem vos espanteis diante deles.", ref: "Deuteronômio 31:6" },
  { text: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.", ref: "Mateus 11:28" },
  { text: "O Senhor pelejará por vós, e vós vos calareis.", ref: "Êxodo 14:14" },
  { text: "Tu me farás ver a vereda da vida; na tua presença há fartura de alegrias.", ref: "Salmos 16:11" },
  { text: "Alegrai-vos sempre no Senhor; outra vez digo: alegrai-vos.", ref: "Filipenses 4:4" },
  { text: "Se Deus é por nós, quem será contra nós?", ref: "Romanos 8:31" },
  { text: "A fé é a certeza daquilo que esperamos e a prova das coisas que não vemos.", ref: "Hebreus 11:1" },
  { text: "O Senhor abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti.", ref: "Números 6:24-25" },
  { text: "Sê forte e corajoso; não temas, nem te espantes, porque o Senhor teu Deus é contigo.", ref: "Josué 1:9" },
  { text: "De sorte que somos transformados de glória em glória na mesma imagem.", ref: "2 Coríntios 3:18" },
];

export default function DailyVerse() {
  const verse = useMemo(() => {
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
    );
    return VERSES[dayOfYear % VERSES.length];
  }, []);

  return (
    <div className="flex items-start gap-3 bg-white/60 backdrop-blur-sm rounded-xl px-5 py-4 border border-amber-200/50 shadow-sm">
      <BookOpen className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm italic text-amber-900 leading-relaxed">"{verse.text}"</p>
        <p className="text-xs text-amber-600 mt-1 font-medium">{verse.ref}</p>
      </div>
    </div>
  );
}
