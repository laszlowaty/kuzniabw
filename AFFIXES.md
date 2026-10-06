# Ocena afiksów na Morii

Strona ocenia przedmioty na podstawie zapisanego katalogu R21 w `item-components/`. Nie korzysta z list polecanych przedmiotów ani przykładów z forum. Model jest w `strong-combos.js`, a ograniczenia tatuaży i premie ras w `profile-affixes.js`.

## Jak powstaje oznaczenie

- Dla kategorii przedmiotu porównujemy cechy prefiksu oraz sufiksu z cechami przedmiotu referencyjnego bez afiksu. Ranking używa stałego wariantu katalogowego, więc etykiety nie zmieniają się wraz z jakością ani ulepszeniem przedmiotu. Wartości `niekompletny` nie są liczone jako aktywne.
- Statystyki bojowe otrzymują wagi zależne od rodzaju broni i wybranego tatuażu. Ataki, obrażenia, trafienie, krytyki, zwinność i spostrzegawczość mają znaczenie dla różnych stylów walki. Rasa zmienia wagę korzyści, którą już częściowo zapewnia jej bonus.
- Afiks otrzymuje etykietę „dobry”, gdy jego dodatni wynik mieści się w najlepszych 30% dodatnich wyników afiksów tej samej osi i kategorii. „Dobra para” oznacza dwa takie afiksy w jednym przedmiocie. Nie oznacza dodatkowego bonusu synergii.
- Osobna etykieta tatuażu lub rasy używa tych samych obliczeń dla profilu. Tatuaż wyklucza niezgodną broń oraz zbroję, której obrona nie mieści się w możliwym zakresie limitów. Poziomy poszczególnych tatuaży nie są znane, więc zgodność nie potwierdza aktywacji bonusu.
- Przy sortowaniu „Najlepsze spawy” najpierw liczy się ocena dla profilu i zgodność z tatuażem, później ogólne afiksy i wynik statystyk uwzględniający bazę, a przy remisie liczba spawów.

Jeżeli w ekwipunku są pozostałe części zestawu, prefiks z niekompletnym bonusem może dostać niewielką premię za możliwość ułożenia zestawu. To tylko potencjał: lista ekwipunku nie mówi, co jest aktualnie założone ani czy części spełniają wszystkie warunki zestawu. Sam niekompletny bonus nadal nie wchodzi do oceny aktywnych cech.

Ocena jest heurystyką przyrostu cech bojowych. Nie znamy statystyk postaci, poziomów tatuaży, przeciwnika, cen rynkowych ani kompletnego wyposażenia założonego do walki. Etykieta „dobry” nie jest obietnicą wyższego DPS ani opłacalności zakupu za konkretną cenę.
