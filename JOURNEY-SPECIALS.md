# Ataki specjalne w podróżach

Źródła sprawdzone 12.10.2026:

- [BWpedia PL — Podróż](https://wiki.bloodwars.pl/index.php?title=Podr%C3%B3%C5%BC): losowanie rodzaju akcji na początku walki z bossem.
- [BWpedia FR — Le voyage](https://wiki.fr.bloodwars.net/index.php?title=Le_voyage): sekcje „Les Boss” i „Les attaques spéciales”, efekty, koszty, jedno użycie na walkę, bez opłacania krwią.
- [Tabela StaregoNerda](https://docs.google.com/document/d/1jZtSvNYHQoS9i6bEJV1Wi1g6hnC2A-GhbKXx3ZLPH6M/mobilebasic): obserwowane akcje poszczególnych bossów. Zielone pola oznaczają częstsze obserwacje, nie wyłączność.

Każdy boss, także pośredni, ma osobno wylosowany specjal i limit jednego użycia. Koszt jest zaokrąglanym w górę ułamkiem początkowego parametru **bez bonusów dziennych**. Nazwy poniżej są identyfikatorami kalkulatora.

| Akcja | Parametr | Ułamek |
|---|---|---|
| calm | wygląd | 1/4 |
| provoke | inteligencja | 1/4 |
| brainwash | wiedza | 1/5 |
| agility | zwinność | 1/10 |
| restore | siła | 1/4 |
| highest | spostrzegawczość | 1/5 |
| counter | odporność | 1/8 |
| disorient | spostrzegawczość | 1/4 |
| prophet | charyzma | 1/5 |
| ignore | odporność | 1/8 |
| persuade | charyzma | 1/4 |
| scout | spostrzegawczość | 1/5 |
| underestimate | inteligencja | 1/8 |
| intimidate | wpływy | 1/4 |
| weakness | wiedza | 1/3 |

## Model i granice dokładności

Lista w polskim dokumencie jest obserwacyjna i niepełna. Kalkulator uzupełnia ją o sześć akcji wspólnych z francuskiej wiki. Przyjmuje 50% na akcję charakterystyczną bossa (obserwacja empiryczna wiki dotycząca bossa końcowego), resztę dzieli równo między wspólne akcje. Zastosowanie tego rozkładu również do mini bossa jest ekstrapolacją. To **założenie modelu**, nie potwierdzony rozkład serwera.

Planowanie losuje 100 scenariuszy trasy, tożsamości mini bossa i jego specjala ze stałym ziarnem. Losowe parametry rund i efekty wybranego specjala są uśredniane. Przy bossie końcowym uśredniane są także wszystkie możliwe specjale. Akcja jest opcjonalna; solver porównuje użycie teraz, zachowanie na później oraz przejście bez niej. Krew nigdy nie zastępuje kosztu specjala.

Interaktywne decyzje przy mini bossie korzystają z maksymalnie 12 wspólnych próbek dalszej trasy, aby ograniczyć czas przeliczania. Dobór sprzętu korzysta z tego samego modelu co planer; podstawy kosztów i regeneracji są przeliczane dla każdego zestawu.

Wciąż są nieudokumentowane szczegóły: zaokrąglenia przy obniżkach i regeneracji, rozstrzyganie remisów, dokładna pula losowego parametru. Model zaokrągla obniżone koszty do najbliższej liczby całkowitej, przyrosty w dół; wzmocnienie Skorpiona liczy od bieżącego stanu po opłacie, regenerację od bazy, bez ograniczania do bazy. Remisy rozstrzyga kolejność parametrów. Losowy parametr obejmuje dziewięć statystyk; trzy wzmocnienia to trzy różne statystyki. Koszt specjala w trybie na żywo można zastąpić wartością z gry.

100% oznacza sukces we wszystkich sprawdzonych scenariuszach modelu, nie dowód dla każdej możliwej podróży. Nie uwzględniamy odpoczynku do następnego dnia.

## Zapis podróży

`offer` zapisuje rodzaj specjala i opcjonalny koszt z gry. `special` zapisuje rzeczywisty wynik losowania, a nie wynik zasymulowany. Nieudany skrót rundy pozostaje w tej samej rundzie i zużywa specjal. Zwycięstwo w trzeciej rundzie kończy walkę. Efekty i limit resetują się przed kolejnym bossem. Cofanie i odświeżenie odtwarzają ten sam dziennik; nielegalne drugie użycie lub zmiana już ujawnionego parametru odcinają nieprawidłową końcówkę zapisu.

Stare zapisy bez wpisów `offer`/`special` pozostają obsługiwane: dotychczasowe wydatki nie zmieniają się, a przyszłe szanse uwzględniają możliwość użycia specjala.

## Audyt 2026-10-12

Ponowne sprawdzenie polskiej i francuskiej BWpedii: sekcja francuska „Les Boss” obejmuje przeciwników pośrednich i końcowych, a limit użycia odnosi do jednej walki. Polska wiki potwierdza losowanie rodzaju specjala na początku walki z bossem. Są to opisy wiki, nie bezpośredni test aktualnego serwera R21. Nie znaleziono rozstrzygających źródeł dla wymienionych wyżej szczegółów zaokrągleń i losowania.

Rozszerzona regresja obejmuje:

- 540 porównań zoptymalizowanego solvera bossa końcowego z ogólnym solverem mini bossa: wszystkie 15 efektów, każda runda, różne zasoby;
- 378 kombinacji katalogu: dziewięciu bossów, dwie role, trzy rundy i siedem dostępnych specjali; 1368 wyników losowych wraz z odtwarzaniem zapisu i blokadą ponownego użycia;
- niezależny przykład rachunkowy: gdy konieczne są dwa udane pominięcia rundy po 20%, szansa ukończenia wynosi 4%; brak specjala przy którymkolwiek bossie obniża ją do zera;
- przeglądarkowe scenariusze sukcesu i porażki pominięcia ostatniej rundy obu bossów, nowy wybór specjala przy bossie końcowym, cofanie, odświeżanie i zmiana kosztu.

Naprawiono komunikat o braku dostępnych opcji, który pomijał możliwość opłacenia specjala. Test przeglądarkowy sprawdza, że komunikat nie pojawia się przed próbą ratunkową, a pojawia się po nieudanym, zużytym specjalu.
