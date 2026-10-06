# Kuźnia R21 · BloodWars

Statyczna aplikacja do przeglądania tabel łączeń R21 i planowania spawów z własnego ekwipunku. Całe obliczenia odbywają się w przeglądarce; aplikacja nie wysyła ekwipunku na serwer.

W sekcji „Czego brakuje do przedmiotu?” wybiera się rodzaj, bazę, prefiks i sufiks z tabel. Dla maksymalnie dwóch spawów aplikacja pokazuje przepisy z ekwipunku oraz do dwóch brakujących składników. Brakujące przedmioty są proponowane na poziomie +1; zwykłe składniki +0 z ekwipunku wymagają podniesienia do +1. Podane przepisy dotyczą nazwy, więc poziom jakości wyniku może się różnić.

Obok rasy i tatuażu można wybrać płeć postaci. Wyniki spawów są wtedy filtrowane według ograniczeń „PŁEĆ” w katalogu R21, a niepasujące przedmioty w ekwipunku są oznaczone. Wyszukiwarka brakujących składników ostrzega, gdy wybrany cel jest niedostępny dla tej płci. Brak wyboru płci pokazuje wszystkie wyniki.

## Uruchomienie lokalne

Otwórz projekt przez lokalny serwer HTTP, ponieważ aplikacja korzysta z modułów JavaScript i Web Workera. Przykładowo:

```powershell
python -m http.server 8000
```

Następnie otwórz http://localhost:8000.

## GitHub Pages

Repozytorium zawiera gotową statyczną stronę. W **Settings → Pages** ustaw źródło publikacji na **GitHub Actions**. Po wysłaniu workflow na GitHub publikację uruchomisz ręcznie w **Actions → Publish GitHub Pages → Run workflow**. Zmiany w repozytorium nie opublikują się, dopóki nie uruchomisz workflow. Adres strony pojawi się w ustawieniach Pages po pierwszym wdrożeniu.

## Dane

Pliki JSON w katalogu głównym i `item-components/` są danymi aplikacji i są potrzebne do jej działania. Tabele łączeń są kopią arkusza udostępnionego przez graczy dla R21; aplikacja opisuje korekty i ograniczenia danych w widoku „Tabele łączeń”.

Statystyki i wartości many/nanitów pochodzą z [oficjalnego katalogu R21](https://r21.bloodwars.pl/test_items.php), dla postaci na poziomie 80. Aplikacja korzysta wyłącznie z zapisanych plików — otwarcie opisu przedmiotu nie odpytuje serwera gry. Katalog obejmuje bazy, prefiksy i sufiksy z dziesięciu kategorii naszych tabel, w jakościach zwykłych, legendarnych, epickich i starożytnych (+0–+5).

`item-requirements.json` uzupełnia wymagania epickich i starożytnych kombinacji. Zaokrąglone wymagania składników nie zawsze można po prostu zsumować. Model zachowuje możliwe wartości przed zaokrągleniem i zawęża je na podstawie zapisanych odczytów R21. Pokazuje liczbę tylko wtedy, gdy wszystkie dopuszczalne możliwości dają ten sam wynik.

Koszt zwykłego spawu to suma many i nanitów **obu zużywanych składników**, nie wartość przedmiotu wynikowego. Każdy etap wymaga też kamienia przemiany. Regułę opisuje [BWpedia — Studnia Dusz](https://wiki.bloodwars.pl/index.php?title=Studnia_Dusz). Planner uwzględnia zwykłe przedmioty +0 jako składniki po założonym podniesieniu do +1 i wyraźnie oznacza ten krok. Koszt spawu liczy z wartości składnika po podniesieniu; nie dolicza kosztu samego ulepszania. Dobre i doskonałe +0 nie wymagają takiego podniesienia. Planner obsługuje zwykłe spawy od (+1) do Doskonały (+5), z wyłączeniem pary dwóch Doskonałych (+5). Nie dolicza obniżania jakości ani odrębnych operacji Kuźni Kaina/transferu epickości. Przedmioty pozostałych jakości nadal można importować i przeglądać.

## Kontrola danych

Oznaczenia dobrych par oraz pojedynczych afiksów opisuje [Ocena afiksów na Morii](AFFIXES.md). Popup przedmiotu pokazuje przyrost cech względem innych afiksów. Ocena uwzględnia wybraną rasę i tatuaż, ale nie jest wyceną ani obliczeniem DPS.

Wymagany Node.js 22 lub nowszy. Testy nie wymagają instalowania zależności i nie wykonują zapytań do BloodWars:

```powershell
npm test
npm run qa:catalog
npm run qa:sources
```

Audyt sprawdza wszystkie kombinacje lokalnego katalogu, w tym prefiksy bez sufiksu, jakości, identyfikatory źródłowe, obecność wymagań i wartości kosztów. Testy porównują statystyki z zapisanymi próbkami oficjalnego katalogu. GitHub Actions wykonuje QA przy zmianach oraz przed ręczną publikacją Pages; samo QA nie publikuje strony.

Odtworzenie pliku wymagań z już zapisanych źródeł, całkowicie offline:

```powershell
npm run build:requirements
```

Narzędzia w `scripts/` służą również do ręcznej aktualizacji danych. `sample-r21.mjs` przyjmuje konkretne nazwy (maksymalnie 50), pomija istniejące odczyty i robi przerwy pomiędzy zapytaniami. Przełącznik `--validation` zapisuje niezależne próbki kontrolne, których model nie używa do kalibracji. `calibrate-requirements.mjs` przyjmuje kategorię, poziom jakości 18–29 i jawny budżet odczytów. Wybiera kombinacje rozstrzygające niejednoznaczności, odczekuje minimum 2,5 sekundy między zapytaniami i zapisuje postęp po każdym odczycie. Błąd HTTP lub niezgodność źródła zatrzymuje pracę bez automatycznej pętli ponawiania. Nie uruchamiaj kilku procesów aktualizacji równocześnie.

## Licencja

Kod i zawartość tego repozytorium udostępniono na licencji MIT. Szczegóły znajdują się w pliku [LICENSE](LICENSE).

BloodWars i związane z grą nazwy oraz materiały należą do ich właścicieli. Projekt jest niezależnym narzędziem społecznościowym.
