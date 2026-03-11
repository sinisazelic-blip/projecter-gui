/**
 * Sadržaj korisničkog uputstva (sr).
 * Dopuni svaki "content" po želji — možeš koristiti <p>, <ul>, <li>, <strong>, <a>.
 */

export type UputstvoSekcija = {
  id: string;
  title: string;
  content: string;
};

export const uputstvoSekcije: UputstvoSekcija[] = [
  {
    id: "uvod",
    title: "Uvod",
    content: `<p>Fluxa je operativni sistem koji povezuje cijeli radni tok agencije – od prvog kontakta s klijentom do konačne fakture i izračuna stvarne marže projekta.</p>
<p>Fluxa pomaže agencijama da strukturirane poslove pretvore u kontrolisane projekte i profitabilne fakture, omogućavajući jasan pregled troškova, rada tima i konačne dobiti.</p>
<p><strong>Osnovni tok rada u Fluxi je jednostavan:</strong></p>
<p>Posao (Deal) → Projekat → Faktura → Profit</p>
<p>Proces rada izgleda ovako:</p>
<ol>
<li>Kreira se posao (Deal) i definiše okvir projekta.</li>
<li>Nakon odobrenja klijenta, posao postaje projekat u kojem tim prati faze rada i troškove.</li>
<li>Kada je posao završen, izdaje se faktura.</li>
<li>Fluxa automatski izračunava stvarnu maržu projekta.</li>
</ol>
<p>Cilj sistema je omogućiti agencijama da imaju jasan uvid u to kako nastaje profit i gdje nastaju troškovi.</p>

<p><strong>1. Šta je Fluxa</strong></p>
<p>Fluxa je operativni kontrolni sistem namijenjen kreativnim i marketinškim agencijama.</p>
<p>Sistem povezuje cijeli životni ciklus rada agencije u jedan jasan tok:</p>
<p>Posao → Projekat → Faktura → Stvarna dobit</p>
<p>Fluxa omogućava vlasnicima i menadžerima da:</p>
<ul>
<li>planiraju projekte</li>
<li>prate stvarne troškove rada</li>
<li>kontrolišu budžete</li>
<li>analiziraju profitabilnost projekata</li>
</ul>
<p>Umjesto korištenja više odvojenih alata za prodaju, projekte i finansije, Fluxa sve objedinjuje u jedinstveni operativni sistem.</p>

<p><strong>2. Kome je Fluxa namijenjena</strong></p>
<p>Fluxa je dizajnirana za male i srednje agencije koje istovremeno vode više klijentskih projekata.</p>
<p>Tipični korisnici su:</p>
<ul>
<li>marketinške agencije</li>
<li>kreativni studiji</li>
<li>agencije za brendiranje</li>
<li>digitalne produkcijske agencije</li>
<li>dizajnerski i komunikacijski studiji</li>
</ul>
<p>Posebno je korisna za:</p>
<ul>
<li>vlasnike agencija</li>
<li>projekt menadžere</li>
<li>account menadžere</li>
</ul>
<p>Fluxa omogućava jasan pregled projekata, troškova i profitabilnosti bez potrebe za kompleksnim poslovnim softverom.</p>

<p><strong>3. Kako Fluxa funkcioniše</strong></p>
<p>Fluxa organizuje rad kroz tri povezane faze:</p>
<p><strong>1. Deals (Pregovori)</strong><br>U ovoj fazi definiše se potencijalni projekat:</p>
<ul>
<li>klijent</li>
<li>obim posla</li>
<li>procijenjeni budžet</li>
</ul>
<p><strong>2. Projekat</strong><br>Kada klijent potvrdi posao, deal se pretvara u projekat. Tokom projekta prati se:</p>
<ul>
<li>napredak rada</li>
<li>faze projekta</li>
<li>interni troškovi</li>
</ul>
<p><strong>3. Faktura</strong><br>Nakon završetka projekta:</p>
<ul>
<li>izdaje se faktura</li>
<li>sistem izračunava stvarnu maržu projekta</li>
</ul>
<p>Ovaj tok rada daje vlasnicima agencija potpunu sliku poslovanja.</p>

<p><strong>4. Kako se registrovati u Fluxi</strong></p>
<p>Da biste koristili Fluxu, potrebno je da dobijete pristup od administratora ili da kreirate novi radni prostor.</p>
<p>Koraci prijave:</p>
<ol>
<li>Otvorite Fluxa login stranicu</li>
<li>Unesite email adresu i lozinku</li>
<li>Izaberite organizaciju (ako ih imate više)</li>
<li>Kliknite Prijava</li>
</ol>
<p>Nakon prijave otvara se Dashboard, centralna kontrolna tabla sistema.</p>

<p><strong>5. Odabir jezika i tržišta</strong></p>
<p>Fluxa podržava više jezika i regionalnih konfiguracija.</p>
<p>Prilikom prvog korištenja možete odabrati:</p>
<p><strong>Jezik</strong> – jezik korisničkog interfejsa (npr. engleski).</p>
<p><strong>Tržište / Regija</strong> – regionalne postavke koje definišu:</p>
<ul>
<li>valutu</li>
<li>porezne stope</li>
<li>format datuma</li>
<li>finansijska pravila</li>
</ul>
<p>Ove postavke se kasnije mogu promijeniti u Korisničkim postavkama.</p>`,
  },
  {
    id: "dashboard",
    title: "Dashboard",
    content: `<p><img src="/uputstvo/dashboard.png" alt="Dashboard" style="max-width:100%; border-radius:8px; margin-bottom:12px;" /></p>
<p>Dashboard predstavlja centralnu kontrolnu tablu Fluxe.</p>
<p>Sa ove stranice korisnik može pristupiti svim glavnim modulima sistema.</p>
<p>Dashboard je organizovan u nekoliko funkcionalnih sekcija:</p>
<ul>
<li>operativni rad</li>
<li>finansije</li>
<li>analitika</li>
<li>sistemske postavke</li>
</ul>
<p>Ovakva struktura omogućava brzo kretanje između svakodnevnih operativnih zadataka i administrativnih funkcija.</p>

<p><strong>Desk</strong></p>
<p>Modul Desk predstavlja početnu tačku operativnog rada.</p>
<p>Sadrži tri ključna elementa:</p>
<p><strong>Deals</strong> – lista pregovora sa klijentima.</p>
<p><strong>SC (Strategic Core)</strong> – brzi kalkulator za procjenu vrijednosti projekta.</p>
<p><strong>PP (Pregled Projekata)</strong> – lista svih projekata u sistemu.</p>
<p>Operativni tok rada je: Deal → Project → Invoice → Profit</p>

<p><strong>Finansije</strong></p>
<p>Modul Finansije sadrži alate za upravljanje finansijskim dokumentima.</p>
<p>U ovom dijelu sistema moguće je:</p>
<ul>
<li>upravljati fakturama</li>
<li>voditi evidenciju finansijskih dokumenata</li>
<li>pratiti operativne finansijske tokove</li>
</ul>
<p>Dostupnost nekih funkcija može zavisiti od regionalnih finansijskih pravila.</p>

<p><strong>Profit / Finansijska analiza</strong></p>
<p>Ovaj modul omogućava analizu finansijskih rezultata.</p>
<p>Korisnici mogu:</p>
<ul>
<li>analizirati profit projekata</li>
<li>pratiti marže</li>
<li>generisati finansijske izvještaje</li>
<li>analizirati profit po klijentu</li>
</ul>
<p>Ovi alati pomažu menadžmentu da razumije kako operativne odluke utiču na finansijske rezultate.</p>

<p><strong>Šifarnici</strong></p>
<p>Modul Šifarnici sadrži operativne podatke koji se koriste u cijelom sistemu.</p>
<p>Ovdje se upravlja sljedećim elementima:</p>
<ul>
<li>Klijenti</li>
<li>Talenti / saradnici</li>
<li>Dobavljači</li>
<li>Cjenovnici</li>
<li>Radne faze</li>
<li>Članovi tima</li>
</ul>
<p>Ispravno održavanje šifarnika omogućava dosljednu strukturu projekata i ponuda.</p>

<p><strong>Firma Settings</strong></p>
<p>Ovaj modul omogućava administratorima da konfigurišu parametre organizacije.</p>
<p>U njemu se definišu:</p>
<ul>
<li>podaci o firmi</li>
<li>finansijske postavke</li>
<li>korisničke uloge</li>
<li>sistemske konfiguracije</li>
</ul>
<p>Ove postavke utiču na ponašanje cijelog sistema.</p>`,
  },
  {
    id: "deals",
    title: "Deals (Pregovori)",
    content: `<p><img src="/uputstvo/deal.png" alt="Deal / Pregovor" style="max-width:100%; border-radius:8px; margin-bottom:12px;" /></p>
<p>Modul Deals služi za upravljanje prodajnim prilikama prije nego što posao postane projekat.</p>
<p>Svaki Deal predstavlja potencijalni projekat povezan sa klijentom.</p>
<p>U ovoj fazi definišu se:</p>
<ul>
<li>naziv posla</li>
<li>klijent</li>
<li>procijenjeni budžet</li>
<li>odgovorna osoba</li>
</ul>
<p>Tokom pregovora status se može mijenjati kako bi se pratila faza pregovora.</p>
<p>Svaki deal ima svoj timeline aktivnosti gdje se bilježe:</p>
<ul>
<li>napomene</li>
<li>promjene ponude</li>
<li>komunikacija sa klijentom</li>
</ul>
<p>Kada klijent prihvati ponudu, deal se pretvara u projekat.</p>

<p><strong>Deal (Detalj pregovora)</strong></p>
<p>Prozor Deal predstavlja centralno mjesto za upravljanje pregovorima.</p>
<p>Ovdje se definišu:</p>
<ul>
<li>rokovi projekta</li>
<li>budžet</li>
<li>stavke ponude</li>
<li>tok pregovora</li>
</ul>

<p><strong>Status i faze Deala</strong></p>
<p>Na vrhu prozora nalazi se linija statusa koja prikazuje fazu pregovora:</p>
<ul>
<li>Deal – početna faza</li>
<li>Produkcija – projekat je prihvaćen</li>
<li>Završen – projekat završen</li>
<li>Zatvoren – projekat administrativno zaključen</li>
<li>Fakturisan – izdata faktura</li>
<li>Arhiviran – projekat arhiviran</li>
</ul>
<p>Kada je projekat zatvoren, deal postaje read-only.</p>

<p><strong>Timeline</strong></p>
<p>Timeline bilježi ključne događaje pregovora.</p>
<p>Unose se:</p>
<ul>
<li>datum otvaranja pregovora</li>
<li>rok projekta</li>
<li>način potvrde posla</li>
<li>napomene</li>
</ul>

<p><strong>Stavke i budžet</strong></p>
<p>U sekciji Stavke definiše se finansijski dio ponude.</p>
<p>Korisnik može:</p>
<ol>
<li>izabrati stavku iz cjenovnika</li>
<li>definisati količinu</li>
<li>unijeti cijenu</li>
<li>dodati opis</li>
</ol>
<p>Sistem automatski izračunava:</p>
<ul>
<li>vrijednost stavke</li>
<li>ukupni budžet projekta</li>
</ul>

<p><strong>Pretvaranje Deala u projekat</strong></p>
<p>Kada klijent potvrdi posao:</p>
<ul>
<li>budžet se prenosi u projekat</li>
<li>pokreće se projektni workflow</li>
<li>pregovarački dio se zaključava</li>
</ul>
<p>Deal tada postaje osnova za operativni rad projekta.</p>`,
  },
  {
    id: "pp",
    title: "Pregled projekata (PP)",
    content: `<p>Pregled projekata prikazuje listu svih projekata u sistemu.</p>
<p>U ovom modulu moguće je:</p>
<ul>
<li>pregledati aktivne projekte</li>
<li>filtrirati projekte po statusu</li>
<li>pregledati arhivu projekata</li>
<li>sortirati projekte po različitim kriterijima</li>
</ul>
<p>Iz ove liste moguće je otvoriti detalje projekta i upravljati njegovim fazama i finansijama.</p>`,
  },
  {
    id: "detalj-projekta",
    title: "Detalji projekta",
    content: `<p><img src="/uputstvo/projekt.png" alt="Detalji projekta" style="max-width:100%; border-radius:8px; margin-bottom:12px;" /></p>
<p>Ekran Detalji projekta predstavlja centralnu operativnu konzolu za upravljanje projektom. Njegova glavna svrha je povezivanje planiranog budžeta sa stvarnim troškovima kako bi projekt menadžer u svakom trenutku imao jasan pregled profitabilnosti.</p>
<p>Ovdje se upravlja:</p>
<ul>
<li>statusom projekta</li>
<li>finansijskim troškovima</li>
<li>radnim fazama</li>
<li>završetkom projekta</li>
</ul>

<p><strong>Definisanje statusa i toka rada</strong></p>
<p>Na vrhu ekrana nalazi se workflow traka koja prikazuje trenutni status projekta.</p>
<p>Promjenom statusa projekt menadžer signalizira sistemu u kojoj fazi se projekat nalazi.</p>
<p>Primjeri faza uključuju:</p>
<ul>
<li>Produkcija</li>
<li>Završen</li>
<li>Zatvoren</li>
<li>Fakturisan</li>
<li>Arhiviran</li>
</ul>
<p>Kada projekat dobije status Fakturisan, sistem ga priprema za finansijsko zatvaranje i izdavanje računa.</p>

<p><strong>Praćenje finansijskog stanja projekta</strong></p>
<p>Fluxa automatski prati finansijsko stanje projekta u realnom vremenu.</p>
<p>Sistem prikazuje:</p>
<ul>
<li>planirani budžet projekta</li>
<li>ukupne troškove</li>
<li>planiranu zaradu</li>
</ul>
<p>Cilj projekt menadžera je da ukupni troškovi ostanu manji od planiranog budžeta, čime se osigurava pozitivna marža projekta.</p>
<p>Vizuelni indikatori (boje i statusi) pomažu da se brzo prepozna da li projekat prelazi planirane finansijske granice.</p>

<p><strong>Operativni unos troškova</strong></p>
<p>Sekcija za unos troškova služi za evidentiranje svih troškova koji nastaju tokom realizacije projekta.</p>
<p>Prilikom unosa troška definišu se:</p>
<ul>
<li>tip troška (npr. honorar, usluga, produkcija)</li>
<li>osoba ili saradnik na kojeg se trošak odnosi</li>
<li>iznos troška</li>
<li>valuta</li>
</ul>
<p>Ako je trošak označen kao nastao, on se automatski oduzima od budžeta projekta.</p>
<p>Ako je trošak samo planiran, služi kao rezervacija budžeta.</p>

<p><strong>Valutna konverzija</strong></p>
<p>Fluxa podržava unos troškova u različitim valutama.</p>
<p>Polje Kurs omogućava automatsku konverziju troškova u osnovnu valutu sistema.</p>
<p>Sistem koristi kurs Centralne banke u trenutku unosa troška, čime se osigurava stabilan finansijski obračun.</p>

<p><strong>Dokumentovanje i revizija</strong></p>
<p>Za svaki trošak moguće je dodati napomenu koja objašnjava kontekst troška.</p>
<p>Ove napomene pomažu tokom:</p>
<ul>
<li>finansijskih revizija</li>
<li>analize projekta</li>
<li>interne komunikacije</li>
</ul>
<p>Tabela troškova na dnu ekrana prikazuje hronologiju svih unosa.</p>

<p><strong>Planiranje faza projekta</strong></p>
<p>Dugme FAZE otvara poseban ekran sa Gantt dijagramom koji prikazuje sve faze projekta i njihove rokove.</p>
<p>Ovaj prikaz omogućava:</p>
<ul>
<li>planiranje redoslijeda faza</li>
<li>definisanje mikro rokova</li>
<li>kontrolu zavisnosti između faza</li>
</ul>
<p>Fluxa automatski sprječava da rok pojedine faze prelazi krajnji rok projekta.</p>

<p><strong>Završetak projekta</strong></p>
<p>Dugme FINAL OK koristi se kada su sve faze projekta završene.</p>
<p>U tom trenutku:</p>
<ul>
<li>projekat se označava kao završen</li>
<li>projekat se vraća u Deal modul</li>
<li>account menadžer može potvrditi završetak sa klijentom</li>
</ul>
<p>Kada klijent potvrdi završetak projekta, status se postavlja na Zatvoren.</p>
<p>Od tog trenutka projekat postaje ReadOnly i prelazi u finansijski dio sistema za izdavanje fakture.</p>`,
  },
  {
    id: "fakturisanje",
    title: "Fakturisanje i fakture",
    content: `<p><img src="/uputstvo/faktura.png" alt="Faktura" style="max-width:100%; border-radius:8px; margin-bottom:12px;" /></p>
<p>Fluxa koristi wizard proces u tri koraka za generisanje faktura.</p>
<p>Ovaj proces omogućava pretvaranje završenih projekata u službene finansijske dokumente.</p>

<p><strong>Korak 1 — Selekcija projekata</strong></p>
<p>U prvom koraku biraju se projekti koji će biti uključeni u fakturu.</p>
<p>Moguće je filtrirati projekte prema:</p>
<ul>
<li>klijentu</li>
<li>vremenskom periodu</li>
<li>statusu projekta</li>
</ul>
<p>Projekti koji imaju status Zatvoren spremni su za fakturisanje.</p>
<p>Odabirom projekata sistem prikazuje:</p>
<ul>
<li>osnovnu cijenu</li>
<li>iznos PDV-a</li>
<li>ukupni iznos</li>
</ul>

<p><strong>Korak 2 — Podešavanje fakture</strong></p>
<p>U drugom koraku definišu se tehnički parametri fakture.</p>
<p>Unose se:</p>
<ul>
<li>datum fakture</li>
<li>valuta</li>
<li>PDV režim</li>
<li>naziv projekta ili stavke</li>
</ul>
<p>Sistem automatski generiše poziv na broj, koji omogućava kasnije automatsko povezivanje uplate sa fakturom.</p>
<p>Po potrebi moguće je promijeniti naziv projekta kako bi odgovarao terminologiji koju klijent koristi.</p>

<p><strong>Korak 3 — Pregled fakture</strong></p>
<p>Treći korak prikazuje vizuelni pregled fakture prije izdavanja.</p>
<p>Na ovom ekranu moguće je provjeriti:</p>
<ul>
<li>podatke o izdavaocu</li>
<li>podatke o klijentu</li>
<li>stavke fakture</li>
<li>iznos PDV-a</li>
<li>ukupan iznos za plaćanje</li>
</ul>
<p>Sistem automatski dodaje i bankovne instrukcije za plaćanje.</p>
<p>Kada je pregled završen, faktura se može:</p>
<ul>
<li>preuzeti kao PDF</li>
<li>poslati klijentu</li>
</ul>`,
  },
  {
    id: "naplate",
    title: "Naplate",
    content: `<p>Fluxa podržava automatsko knjiženje uplata putem bankovnih izvoda.</p>
<p>Bankovni izvod mora biti u XML V2 formatu, koji podržava većina banaka.</p>
<p>Nakon uvoza izvoda sistem automatski:</p>
<ul>
<li>prepoznaje poziv na broj</li>
<li>povezuje uplatu sa fakturom</li>
<li>označava fakturu kao naplaćenu</li>
</ul>`,
  },
  {
    id: "finansije",
    title: "Finansije",
    content: `<p>Fluxa sadrži kompletan finansijski sistem za analizu poslovanja agencije.</p>
<p>Finansijski modul omogućava:</p>
<ul>
<li>analizu prihoda</li>
<li>analizu troškova</li>
<li>pregled profitabilnosti projekata</li>
<li>finansijske izvještaje</li>
</ul>
<p>Finansijska struktura sistema zasnovana je na standardima međunarodne finansijske analitike.</p>`,
  },
  {
    id: "izvjestaji",
    title: "Izvještaji",
    content: `<p>Fluxa omogućava generisanje različitih poslovnih izvještaja.</p>
<p>Najvažniji fokus sistema je praćenje marže, koja predstavlja ključni pokazatelj uspješnosti agencijskog poslovanja.</p>
<p>Izvještaji omogućavaju analizu:</p>
<ul>
<li>profita po projektu</li>
<li>profita po klijentu</li>
<li>troškova rada</li>
<li>ukupnog poslovanja agencije</li>
</ul>`,
  },
  {
    id: "mobile",
    title: "Mobile",
    content: `<p>Modul Mobile omogućava praćenje poslovanja putem mobilnih uređaja.</p>
<p>Namijenjen je prvenstveno:</p>
<ul>
<li>vlasnicima agencija</li>
<li>operativnim menadžerima</li>
</ul>
<p>Putem mobilnog interfejsa moguće je:</p>
<ul>
<li>pratiti vrijednost aktivnih projekata</li>
<li>pregledati završene projekte</li>
<li>pristupiti listi Deals pregovora</li>
<li>pregledati detalje projekata</li>
</ul>
<p>Mobile verzija sistema prikazuje pojednostavljene informacije optimizovane za mobilne uređaje.</p>
<p>U ovaj modul integrisan je i Strategic Core (SC) kalkulator koji omogućava brzu procjenu vrijednosti projekta tokom pregovora sa klijentom.</p>`,
  },
  {
    id: "studio",
    title: "Firma Settings",
    content: `<p>Modul Firma Settings predstavlja centralno mjesto za definisanje identiteta kompanije unutar Fluxa sistema.</p>
<p>Podaci uneseni u ovom modulu koriste se prilikom generisanja faktura i drugih dokumenata.</p>

<p><strong>Osnovni podaci</strong></p>
<p>U ovom dijelu unose se:</p>
<ul>
<li>naziv firme</li>
<li>skraćeni naziv</li>
<li>email</li>
<li>telefon</li>
<li>web stranica</li>
</ul>
<p>Također je moguće uploadovati logotip kompanije koji će se pojavljivati na fakturama.</p>

<p><strong>Adresa firme</strong></p>
<p>Unose se:</p>
<ul>
<li>adresa</li>
<li>grad</li>
<li>poštanski broj</li>
<li>država</li>
</ul>
<p>Ovi podaci se automatski prikazuju na svim finansijskim dokumentima.</p>

<p><strong>Porezni podaci</strong></p>
<p>Za pravno validne fakture potrebno je unijeti:</p>
<ul>
<li>identifikacioni broj firme</li>
<li>PDV broj</li>
<li>broj rješenja o registraciji</li>
</ul>

<p><strong>Bankovni računi</strong></p>
<p>Fluxa omogućava unos više bankovnih računa.</p>
<p>Jedan račun mora biti označen kao glavni račun.</p>
<p>Za međunarodne uplate moguće je unijeti:</p>
<ul>
<li>IBAN</li>
<li>SWIFT kod</li>
</ul>

<p><strong>Upravljanje korisnicima i ulogama</strong></p>
<p>Fluxa koristi sistem korisničkih uloga za kontrolu pristupa podacima.</p>
<p>Administrator može definisati različite nivoe pristupa:</p>
<ul>
<li><strong>View</strong> – korisnik može samo pregledati podatke</li>
<li><strong>Edit</strong> – korisnik može unositi i mijenjati podatke</li>
<li><strong>Admin</strong> – potpuna kontrola nad sistemom</li>
</ul>

<p><strong>Sigurnost i odgovornost</strong></p>
<p>Svaki korisnik ima vlastiti login.</p>
<p>Sistem automatski bilježi:</p>
<ul>
<li>ko je unio trošak</li>
<li>ko je promijenio status projekta</li>
<li>ko je generisao fakturu</li>
</ul>
<p>Na taj način se osigurava transparentnost i sigurnost poslovnih podataka.</p>`,
  },
];
