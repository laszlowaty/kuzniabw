# Kuźnia R21 · BloodWars

Statyczna aplikacja do przeglądania tabel łączeń R21 i planowania spawów z własnego ekwipunku. Całe obliczenia odbywają się w przeglądarce; aplikacja nie wysyła ekwipunku na serwer.

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

## Licencja

Kod i zawartość tego repozytorium udostępniono na licencji MIT. Szczegóły znajdują się w pliku [LICENSE](LICENSE).

BloodWars i związane z grą nazwy oraz materiały należą do ich właścicieli. Projekt jest niezależnym narzędziem społecznościowym.
