# QA katalogu R21

Zakres: dziesięć kategorii i afiksy obecne w tabelach Kuźni, poziom postaci 80. Dane są migawką oficjalnego Item Test R21, nie połączeniem z kontem gracza. Kontrola dostępności wszystkich kombinacji nie jest tym samym co pobranie i niezależne sprawdzenie każdej z nich.

## Potwierdzone i poprawione problemy

- Sufiks **Doskonałości** był rozpoznawany jako jakość **Doskonały**. Dobra Kusza Doskonałości otrzymywała w ten sposób 726 zamiast 276 nanitów i niewłaściwe statystyki. Jakość jest teraz odczytywana wyłącznie z początku nazwy, po opcjonalnym „Legendarny”.
- Opis wielu epickich i starożytnych kombinacji, również z samym prefiksem, nie zawierał wymagań. Dodano lokalny model wartości przed zaokrągleniem. Przykład: Starożytna Władcza Kurtka Narkomana wymaga poziomu 159 i siły 164; sumowanie zaokrąglonych wymagań dawało błędny poziom 160.
- Planner dopuszczał przepisy, dla których moduł jakości i kosztów zwracał brak danych. Oba korzystają teraz z tej samej reguły zwykłego spawu. Stany pośrednie o różnych jakościach są zachowywane osobno.
- Poprawiono rodzaj gramatyczny Beretty, Pilum, Uzi, Magnum i AK-47 oraz legendarnych nazw.

## Weryfikacja kosztów

Według [BWpedii — Studnia Dusz](https://wiki.bloodwars.pl/index.php?title=Studnia_Dusz) koszt połączenia jest sumą wartości many i nanitów dwóch składników. Wartość wyniku nie jest kosztem tego samego spawu. Przy kolejnym spawie wynik poprzedniego etapu staje się nowym zużywanym składnikiem i jego wartość jest liczona na tym etapie.

Test regresyjny: dwie Kusze Doskonałości (+1) kosztują razem **216 many i 72 nanity**. Osobny test kontroluje sumę przepisu dwuetapowego. Kamienie przemiany są liczone po jednym na spaw; ulepszanie i operacje Kuźni Kaina nie są w tej sumie.

Próbki zawierają URL, datę odczytu, nazwę i pełne linie opisu z [R21 Item Test](https://r21.bloodwars.pl/test_items.php). `npm run qa:sources` porównuje wymagania, cechy, obrażenia, obronę, ceny, manę i nanity. Nie odpytuje sieci.

## Odtwarzalność i obciążenie źródła

- `npm test` — regresje nazw, importu prefiksów, jakości, kosztów, planera i popupów oraz porównania ze źródłami.
- `npm run qa:catalog` — wszystkie 1 080 816 obsługiwanych wariantów, w tym 50 496 wariantów z prefiksem bez sufiksu. Brak opisu, wymagań lub prawidłowego kosztu oznacza błąd kontroli.
- `npm run build:requirements` — odtworzenie modelu z zapisanych próbek, bez sieci.
- `tests/browser-smoke.mjs` — opcjonalny test w przeglądarce: pusty start, import, Web Worker, koszt przepisu, popupy i brak zewnętrznych zapytań strony.
- `node tests/missing-list-browser.mjs <ścieżka-do-playwright/index.mjs>` — pełne przedmioty i unikalne afiksy: zgodność z całym zestawem brakujących składników, filtry, zachowanie paginacji i otwartych przepisów, kopiowanie każdego widoku i obsługa odmowy dostępu do schowka, puste wyniki, kategorie bez afiksów oraz układ mobilny. Korzysta z lokalnego Edge.
- `node tests/responsive-browser.mjs <ścieżka-do-playwright/index.mjs>` — układ 320–1920 px, obie zakładki, tabele, import, profil, popup dotykowy i klawiaturowy oraz przejścia między wynikami a przepisem. Korzysta z lokalnego Edge; Playwright nie jest zależnością aplikacji. Opcjonalna zmienna `UI_SCREENSHOTS` wskazuje istniejący katalog na zrzuty ekranu.

Kalibracja nie pobiera iloczynu wszystkich baz i afiksów. Wybiera próbki rozróżniające możliwe zaokrąglenia, zapisuje odczyty i ogranicza tempo do pojedynczego żądania po przerwie co najmniej 2,5 sekundy. Uruchomienie wymaga jawnego budżetu zapytań. Nie działa w przeglądarce ani w workflow QA/Pages. Próbki w `validation-r21.json` służą wyłącznie kontroli i nie są używane przy budowie modelu.

## Szacunek podbijania tierów

Zakładka „Podbijanie tierów” bada każdą parę fizycznych sztuk ze wspólnego ekwipunku, wyłącznie w jednym spawie. Korzysta z tych samych receptur i blokad co silnik. Tier jest pozycją w tabeli źródłowej, a zmiana różnicą względem wyższego tieru składnika; brak afiksu ma tier 0. Ranking rozdziela awanse bez strat, wyniki mieszane, neutralne i straty. Ocena półki nie jest wyceną przedmiotu.

- `tests/tier-estimate.test.mjs` — bilans obu osi, utrata afiksu, duplikaty, klasyfikacja półki, blokady receptur i nieobsługiwane jakości.
- `node tests/tier-browser.mjs <ścieżka-do-playwright/index.mjs>` — import bez uruchamiania wieloetapowej analizy, przejście do zwykłego planera, filtry, klawiatura, zachowanie oryginalnego tekstu, 68 sztuk / 2278 par, paginacja i szerokości 320–1440 px.
