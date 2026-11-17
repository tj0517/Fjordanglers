# Hub destynacji — makieta zaakceptowana przez tj (17 XI 2026)

`hub.dc.html` to makieta strony hubu (`/iceland`) z kanwy Claude Design. Jest źródłem prawdy dla układu,
kolejności sekcji, kolorów, typografii i odstępów. To plik Design Component (HTML ze stylami inline);
tłumaczysz go na komponenty Next.js, nie kopiujesz runtime'u makiety (`support.js`, `<x-dc>`, `<helmet>`).

Kanwa (podgląd na żywo, tj poprawia tam wygląd): https://claude.ai/artifact/Aa6c4TddpQwqCHuwz5p5bk

## Kolejność sekcji
1. Hero: ostre zdjęcie, odsunięte 12 px od krawędzi, max 1560 px szerokości, 640 px wysokości, rogi 28 px.
   Nawigacja (pływająca kremowa belka) leży NA zdjęciu. Po lewej okruszki, H1, intro, dwa przyciski.
   Po prawej fakty, każdy jako osobny półprzezroczysty blok (klasa `.fq` w makiecie).
2. Karty wyjazdów: jedna siatka, filtr po gatunku nad nią. Bez mapy.
3. Kalendarz sezonu: blok na rozmytym zdjęciu z grainem, pasek 12 miesięcy na całą szerokość, pod nim opis i gatunki.
4. Przewodnicy: małe karty (inicjały / zdjęcie, imię, miejsce, jedna linia) w bloku na płaskim granacie.
5. How it works: trzy kroki, każdy na rozmytym zdjęciu z grainem.
6. Opinia klienta: płaski ciemny granat.
7. Artykuły („Read before you go”).
8. FAQ: blok na rozmytym zdjęciu z grainem, każde pytanie osobnym blokiem
   (zamknięte półprzezroczyste z białym tekstem, otwarte kremowe z granatowym tekstem).
9. Inne destynacje (kafle).
10. CTA na rozmytym zdjęciu z grainem.
11. Stopka: na całą szerokość strony, rozmyte zdjęcie z grainem, ciemniejsze.

## Kolory i fonty (te same, co na żywej stronie)
- tło strony `#F3EDE4`, karty i panele `#FDFAF7`, linie `#E3DBCE`
- granat `#0A2E4D` (tekst, nagłówki), ciemny granat `#071C30`, tekst pomocniczy `#4F6275`
- łosoś `#E67E50` (akcent, etykiety, przyciski), jasny łosoś na ciemnym tle `#F6B596`
- nagłówki Fraunces 700, tekst DM Sans (oba są już w `src/app/fonts`)

## Efekt „grain”
Blok = rozmyte zdjęcie + ciemny gradient + tekstura szumu.
- `assets/*-blur.jpg` to gotowe rozmyte zdjęcia (rozmycie Gaussa ~38 px na obrazie 900 px, lekko przyciemnione).
- `assets/grain.png` to kafel szumu 320 px, kładziony na wierzch: `background-size: 180px`,
  `mix-blend-mode: overlay`, krycie 0.85. W makiecie to klasa `.blur` z `::after`.
- gradient nad zdjęciem: `linear-gradient(100deg, rgba(7,22,36,.6), rgba(7,22,36,.25))`.

## Zdjęcia w makiecie (`/_blob/<id>` → plik w `assets/`)
| id w makiecie | plik |
|---|---|
| 2d11274d847994cae19d6c299664b10d | canyon.jpg (hero, karta) |
| 4dee62e3e0d01c73c6ea83c8b1cee251 | iceland.jpg |
| 1c2d8c8cd4da98665ff5fd8bb5ed6306 | guide.jpg |
| 3598092f56c935fac604e507417f55da | nzriver.jpg |
| eceb36806ea80447f19b768a275a7f8f | norway.jpg |
| 582b297cc79907e508bc155227e1bb0c | sweden.jpg |
| a4a80f3c590959793a2be8f4309db050 | finland.jpg |
| c75f0d51487d494143418d2364952c7c | canyon-blur.jpg |
| b2cf832e3cc1819ae0e338f9c333888b | iceland-blur.jpg |
| cc6d8b2d588da6684c3f574e9d2c480e | fjord-blur.jpg |
| 4d95ef2b2721413b5f6420b5b23d807a | finland-blur.jpg |
| 8b44b8b584c56d0d2a5df6e754e5d2a5 | guide-blur.jpg |
| 899236fa4daa8527c2321e771557e977 | grain.png |
| 12f152ff9e5107f9c02d0fee5ebeddd7 | dark-logo.png |
| f41f184a5c6b5bf12cd3e7a30c3d5119 | white-logo.png |

Zdjęcia na kartach wyjazdów i artykułów to zaślepki z `public/`; na stronie idą prawdziwe z bazy.

## Co w makiecie jest prawdziwe, a co nie
- Z bazy: H1, intro, miesiące sezonu i szczytu, opis sezonu, FAQ, nazwy i ceny ofert, przewodnicy, kroki „How it works”.
- Zaślepki w nawiasach kwadratowych: cytat klienta, trzeci artykuł, czas czytania, zdjęcie Patagonii.
- Dwa tytuły artykułów są przykładowe (ułożone z pytań FAQ), takich wpisów jeszcze nie ma.
- Karta faktów w hero („4 guides”, „from €700”) ma być liczona z danych hubu, nie wpisana na sztywno.

## Otwarte
- Przycisk „View trip”: beżowy tekst na łososiu z granatową obwódką. tj jeszcze ocenia kolor obwódki.
- Zdjęcia profilowe przewodników: w makiecie są inicjały; na stronie `guides.avatar_url`.
- Lista artykułów i strona artykułu nie są jeszcze ujednolicone z tym stylem. Poza zakresem tej makiety.
