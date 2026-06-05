/**
 * Convocados Mundial 2026 (listas publicadas en ESPN, jun 2026).
 * Porteros solo en «Mejor portero»; el resto en «Mejor jugador» y «Goleador».
 * Fuente: https://espndeportes.espn.com/futbol/mundial/nota/_/id/16715015/mundial-2026-convocatorias-de-selecciones-todas-las-listas-de-jugadores
 * Regenerar: node scripts/parse-espn-squads.mjs
 */

/** @typedef {{ name: string, country: string, role: "gk" | "outfield" }} SquadEntry */

/** @type {SquadEntry[]} */
export const SQUAD_ENTRIES = [
  {
    "name": "-Engstler",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": ": Akmal Mozgovoy",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": ": Álvaro Montero",
    "country": "Colombia",
    "role": "gk"
  },
  {
    "name": ": Jhon Arias",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": ": Jhon Córdoba",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": ":Eldor Shomurodov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Aaron Hickey",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Aaron Tshibola",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Aaron Wan-Bissaka",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Abbosbek Fayzullaev",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Abdallah Al-Fakhouri",
    "country": "Jordania",
    "role": "gk"
  },
  {
    "name": "Abdallah Nasib",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Abde Ezzalzouli",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Abdelmouhib Chamakh",
    "country": "Túnez",
    "role": "gk"
  },
  {
    "name": "Abdoulaye Seck",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Abdul",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Abdul Mumin",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Abdulaziz Hatem",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Abdulelah Al Amri",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Abdülkerim Bardakci",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Abdulla Abdullaev",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Abdullah Al Hamdan",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Abdullah Al Khaibari",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Abduvakhid Nematov",
    "country": "Uzbekistán",
    "role": "gk"
  },
  {
    "name": "Achraf Abada",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Achraf Hakimi",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Adalberto Carrasquilla",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Adam Arous",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Adam Hlozek",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Adil Boulbina",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Adrien Rabiot",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Agustín Canobbio",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Ahmed",
    "country": "Marruecos",
    "role": "gk"
  },
  {
    "name": "Ahmed Alaa",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Ahmed Alkassar",
    "country": "Arabia Saudita",
    "role": "gk"
  },
  {
    "name": "Ahmed Basil",
    "country": "Irak",
    "role": "gk"
  },
  {
    "name": "Ahmed Fathi",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Ahmed Fatouh",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Ahmed Qasem",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Ahmed Yahya",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Ahmed Zizo",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Ahmetcan Kaplan",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Aiden O’Neill",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Aimar Sher",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Aïssa Mandi",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Ajdin Hrustic",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Akam Hashim",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Akram Afif",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Al-Hashmi Al-Hussain",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Alaa Al Hejji",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Alan Franco",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Alan Minda",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Alban Lafont",
    "country": "Costa de Marfil",
    "role": "gk"
  },
  {
    "name": "Alberto Quintero",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Alejandro Romero Gamarra 'Kaku'",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Alejandro Zendejas",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Aleksandar Pavlovic",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Alessandro Circati",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Alessandro Schopf",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Alex Arce",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Álex Baena",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Alex Freeman",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Álex Grimaldo",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Alex Paulsen",
    "country": "Nueva Zelanda",
    "role": "gk"
  },
  {
    "name": "Alex Rufer",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Alex Sandro",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Alexander Bernhardsson",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Alexander Djiku",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Alexander Isak",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Alexander Nübel",
    "country": "Alemania",
    "role": "gk"
  },
  {
    "name": "Alexander Prass",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Alexander Schlager",
    "country": "Austria",
    "role": "gk"
  },
  {
    "name": "Alexander Sørloth",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Alexandr Sojka",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Alexandre Pierre",
    "country": "Haití",
    "role": "gk"
  },
  {
    "name": "Alexandro Maidana",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Alexis Mac Allister",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Alexis Saelemaekers",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Alexis Vega",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Alfie Jones",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Ali Abdi",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Ali Ahmed",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Ali Al-Hamadi",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Ali Alipour",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Ali Azaizeh",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Ali Jassim",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Ali Lajami",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Ali Majrashi",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Ali Nemati Omid Noorafkan",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Ali Olwan",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Ali Yousef",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Alidu Seidu",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Alireza Beiranvand",
    "country": "Irán",
    "role": "gk"
  },
  {
    "name": "Alireza Jahanbakhsh",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Alisson",
    "country": "Brasil",
    "role": "gk"
  },
  {
    "name": "Alistair Johnston",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Almoez Ali",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Alphonso Davies",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Altay Bayindir",
    "country": "Turquía",
    "role": "gk"
  },
  {
    "name": "Álvaro Fidalgo",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Amad Diallo",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Amadou Onana",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Amar Dedic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Amar Memic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Amer Jamous",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Amine Gouiri",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Amir",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Amir Al-Ammari",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Amir Hadziahmetovic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Amir Mohammad Razzaghinia",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Amirhossein Hosseinzadeh",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Anas Badawi",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Anass Salah-Eddine",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Andreas Schjelderup",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Andrej Kramaric",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Andrés Andrade",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Andrés Cubas",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Andy Robertson",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Ange-Yoan Bonny",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Ángelo Preciado",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Angelo Stiller",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Angus Gunn",
    "country": "Escocia",
    "role": "gk"
  },
  {
    "name": "Aníbal Godoy",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Anis Ben Slimane",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Anis Hadj Moussa",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Ante Budimir",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Anthony",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Anthony Elanga",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Anthony Gordon",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Anthony Ralston",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Antoine Mendy",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Antoine Semenyo",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Antonee Robinson",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Antonio Nusa",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Antonio Rüdiger",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Antonio Sanabria",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Ao Tanaka",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Aqtay Abdallah",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Ar'jany Martha",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Aral Simsir",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Arda Güler",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Ardon Jashari",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Aria Yousefi",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Armando González",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Armando Obispo",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Armin Gigovic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Arthur Masuaku",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Arthur Theate",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Assane Diao",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Assim Madibo",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Aubrey Modiba",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Augustine Boakye",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Aurèle Amenda",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Aurélien Tchouaméni",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Auston Trusty",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Avazbek Ulmasaliyev",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Awer Mabil",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Axel Tuanzebe",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Axel Witsel",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Ayase Ueda",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Ayman Yahya",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Aymen Dahmen",
    "country": "Túnez",
    "role": "gk"
  },
  {
    "name": "Aymen Hussein",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Aymeric Laporte",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Ayoub Al-Alawi",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Ayoub El Kaabi",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Ayoube Amaimouni",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Ayumu Seko",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Ayyoub Bouaddi",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Azarias Londoño",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Aziz Behich",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Azizbek Amonov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Azizjon Amonov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Azzedine Ounahi",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Baba Abdul Rahman",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Bae Jun-Ho",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Balil El Khannouss",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Bamba Dieng",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Bara Sapoko Ndiaye",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Baris Alper Yilmaz",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Bart Verbruggen",
    "country": "Países Bajos",
    "role": "gk"
  },
  {
    "name": "Bazoumana Touré",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Behruzjon Karimov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Ben Gannon-Doak",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Ben Old",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Ben Waine",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Benjamin Asare",
    "country": "Ghana",
    "role": "gk"
  },
  {
    "name": "Benjamin Nygren",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Benjamin Tahirovic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Bernardo Silva",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Besfort Zeneli",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Billy Gilmour",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Borja Iglesias",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Botirali Ergashev",
    "country": "Uzbekistán",
    "role": "gk"
  },
  {
    "name": "Bradley Barcola",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Bradley Cross",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Brahim Díaz",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Braian Ojeda",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Brandley Kuwas",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Brandon Mechele",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Brandon Thomas-Asante",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Breel Embolo",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Bremer",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Brenden Aaronson",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Brian Brobbey",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Brian Cipenga",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Brian Gutiérrez",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Brian Rodríguez",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Brice Samba",
    "country": "Francia",
    "role": "gk"
  },
  {
    "name": "Bruno Fernandes",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Bruno Guimarães",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Bukayo Saka",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Caglar Söyüncü",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Caleb Yirenkyi",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Callan Elliot",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Callum McCowatt",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Cameron Burgess",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Cameron Devlin",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Camilo Vargas",
    "country": "Colombia",
    "role": "gk"
  },
  {
    "name": "Can Uzun",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Carl Fred Sainté",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Carl Starfelt",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Carlens Arcus",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Carlos Acevedo",
    "country": "México",
    "role": "gk"
  },
  {
    "name": "Carlos Andrés Gómez",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": "Carlos Harvey",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Carney Chukwuemeka",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Casemiro",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Cecilio Waterman",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Cédric Bakambu",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Cedric Itten",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "César Blackman",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "César Huerta",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "César Montes",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "César Samudio",
    "country": "Panamá",
    "role": "gk"
  },
  {
    "name": "César Yanis",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Chadi Riad",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Chancel Mbemba",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Charles De Ketelaere",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Charles Pickel",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Ché Adams",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Chemsdine Talbi",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Cherif Ndiaye",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Cho Kyu-Sung",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Chris Brady",
    "country": "Estados Unidos",
    "role": "gk"
  },
  {
    "name": "Chris Richards",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Chris Wood",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Christ Inao Oulaï",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Christian Fassnacht",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Christian Pulisic",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Christoph Baumgartner",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Christopher Bonsu Baah",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "CJ dos Santos",
    "country": "Cabo Verde",
    "role": "gk"
  },
  {
    "name": "Clément Akpa",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Cody Gakpo",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Connor Metcalfe",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Craig Gordon",
    "country": "Escocia",
    "role": "gk"
  },
  {
    "name": "Cristian Martínez",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Cristian Roldan",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Cristian Romero",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Cristian Volpato",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Cristiano Ronaldo",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Crysencio Summerville",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Cyle Larin",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Daichi Kamada",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Dailon Livramento",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Daizen Maeda",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Damián Bobadilla",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Dan Burn",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Dan Ndoye",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Dani Olmo",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Danial Eiri",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Daniel Svensson",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Danilo",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Danilo Santos",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Danley Jean Jacques",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Darwin Núñez",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "David Affengruber",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "David Alaba",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "David Doudera",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "David Jurásek",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "David Møller Wolfe",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "David Ospina",
    "country": "Colombia",
    "role": "gk"
  },
  {
    "name": "David Raum",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "David Raya",
    "country": "España",
    "role": "gk"
  },
  {
    "name": "David Zima",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Dayne St. Clair",
    "country": "Canadá",
    "role": "gk"
  },
  {
    "name": "Dayot Upamecano",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Dean Henderson",
    "country": "Inglaterra",
    "role": "gk"
  },
  {
    "name": "Declan Rice",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Demir Ege Tiknaz",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Denil Castillo",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Denis Visinsky",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Denis Zakaria",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Deniz Gül",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Deniz Undav",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Dennis Dargahi",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Dennis Hadzikadunic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Denzel Dumfries",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Derek Cornelius",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Deroy Duarte",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Derrick Etienne",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Desiré Doué",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Deveron Fonville",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Diego Gómez",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Diego Moreira",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Diney",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Diogo Costa",
    "country": "Portugal",
    "role": "gk"
  },
  {
    "name": "Diogo Dalot",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Djed Spence",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Djibril Sow",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Dodi Lukebakio",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Dom Hyam",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Dominik Kotarski",
    "country": "Croacia",
    "role": "gk"
  },
  {
    "name": "Dominik Livakovic",
    "country": "Croacia",
    "role": "gk"
  },
  {
    "name": "Dominique Simon",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Don Deedson Louicius",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Donyell Malen",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Dostonbek Khamdamov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Douglas",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Duckens Nazon",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Duje Caleta-Car",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Duke Lacroix",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Dylan Batubinsika",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Dylan Bronn",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Dzenis Burnic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Eberechi Eze",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Éderson",
    "country": "Brasil",
    "role": "gk"
  },
  {
    "name": "Edgardo Fariña",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Edin Dzeko",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Edmílson Junior",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Edo Kayembe",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Édouard Mendy",
    "country": "Senegal",
    "role": "gk"
  },
  {
    "name": "Edson álvarez",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Egil Selvik",
    "country": "Noruega",
    "role": "gk"
  },
  {
    "name": "Ehsan Haddad",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Ehsan Hajsafi",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "El Hadji Malick Diouf",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "El Mahdi Soliman",
    "country": "Egipto",
    "role": "gk"
  },
  {
    "name": "Eli Just",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Elias Achouri",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Elias Saad",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Elisha Owusu",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Elliot Anderson",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Elliot Stroud",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Ellyes Skhiri",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Eloy Room",
    "country": "Curazao",
    "role": "gk"
  },
  {
    "name": "Elye Wahi",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Emam Ashour",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Emil Holm",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Emiliano Martínez",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Emiliano Martínez",
    "country": "Argentina",
    "role": "gk"
  },
  {
    "name": "Emmanuel Agbadou",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Endrick",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Enner Valencia",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Enzo Fernández",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Eray Cömert",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Eren Elmali",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Éric Davis",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Eric García",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Erik Lira",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Erik Smith",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Erling Haaland",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Ermedin Demirovic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Ermin Mahmic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Ernest Nuamah",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Esmir Bajraktarevic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Evan Ndicka",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Evann Guessand",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Evidence Makgopa",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Exequiel Palacios",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Ezri Konsa",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Fabián Balbuena",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Fabian Rieder",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Fabián Ruiz",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Fabinho",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Facundo Medina",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Facundo Pellistri",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Fahad Talib",
    "country": "Irak",
    "role": "gk"
  },
  {
    "name": "Farès Chaïbi",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Fares Ghedjemis",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Farrukh Sayfiev",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Fatawu Issahaku",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Federico Valverde",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Federico Viñas",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Felix Nmecha",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Félix Torres",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Feras Al Brikan",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Ferdi Kadioglu",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Fernando Muslera",
    "country": "Uruguay",
    "role": "gk"
  },
  {
    "name": "Ferran Torres",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Fidel Escobar",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Finlay Curtis",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Finn Surman",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Firas Chaouat",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Fiston Mayele",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Florian Grillitsch",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Florian Wiegele",
    "country": "Austria",
    "role": "gk"
  },
  {
    "name": "Florian Wirtz",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Folarin Balogun",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Francis De Vries",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Francisco Conceição",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Francisco Trincão",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Franck Kessié",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Frans Putros",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Frantzdy Pierrot",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Fredrik André Bjørkan",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Fredrik Aursnes",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Frenkie de Jong",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Gabriel Avalos",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Gabriel Gudmundsson",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Gabriel Magalhães",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Gabriel Martinelli",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Gaël Kakuta",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Garry Rodrigues",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Gastón Olveira",
    "country": "Paraguay",
    "role": "gk"
  },
  {
    "name": "Gavi",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Gedeon Kalulu",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "George Hirst",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Gerónimo Rulli",
    "country": "Argentina",
    "role": "gk"
  },
  {
    "name": "Gervane Kastaneer",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Gessime Yassine",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Ghislain Konan",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Gideon Mensah",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Gilberto Mora",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Gilson Benchimol",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Gio Reyna",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Giorgian De Arrascaeta",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Giovani Lo Celso",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Giuliano Simeone",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Godfried Roemeratoe",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Gonçalo Guedes",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Gonçalo Inacio",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Gonçalo Ramos",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Gonzalo Montiel",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Gonzalo Plata",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Gonzalo Valle",
    "country": "Ecuador",
    "role": "gk"
  },
  {
    "name": "Granit Xhaka",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Grant Hanley",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Gregor Kobel",
    "country": "Suiza",
    "role": "gk"
  },
  {
    "name": "Guela Doué",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Guillermo Martínez",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Guillermo Ochoa",
    "country": "México",
    "role": "gk"
  },
  {
    "name": "Guillermo Varela",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Gustaf Lagerbielke",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Gustaf Nilsson",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Gustavo Caballero",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Gustavo Gómez",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Gustavo Puerta",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": "Gustavo Velázquez",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Guus Til",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Habib Diarra",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Hadj Mahmoud",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Haissem Hassan",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Haji Wright",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Hakan Çalhanoglu",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Hamdy Fathy",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Hamza Abdelkarim",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Hannes Delcroix",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Hannibal Mejbri",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Hans Vanaken",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Haris Tabakovic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Harry Kane",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Harry Souttar",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Hassan Al-Haydos",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Hassan Kadesh",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Hassan Tambakti",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Hazem Mastouri",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Helio Varela",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Henrik Falchener",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Hernán Galíndez",
    "country": "Ecuador",
    "role": "gk"
  },
  {
    "name": "Hicham Boudaoui",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Hiroki Ito",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Hjalmar Ekdal",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Hossam Abdelmaguid",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Hossein Hosseini",
    "country": "Irán",
    "role": "gk"
  },
  {
    "name": "Hossein Kanaani",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Houssem Aouar",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Hugo Sochurek",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Husam Abu Dahab",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Hussein Ali",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Hwang Hee-Chan",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Hwang In-Beom",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Ibrahim Adel",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Ibrahim Bayesh",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Ibrahim Maza",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Ibrahim Mbaye",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Ibrahim Saadeh",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Ibrahim Sabra",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Ibrahim Sangaré",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Ibrahima Konaté",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Idrissa Gana Gueye",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Igor Matanovic",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Igor Sergeev",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Igor Thiago",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Iliman Ndiaye",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Ime Okon",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Iñaki Williams",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Iqraam Rayners",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Irfan Can Kahveci",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Isak Hien",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Isidro Pitta",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Ismael Díaz",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Ismaël Gharbi",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Ismaël Koné",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Ismael Saibari",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Ismail Jakobs",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Ismail Yüksek",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Ismaïla Sarr",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Israel Reyes",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Issa Diop",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Issa Laye",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Ivan Basic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Ivan Perisic",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Ivan Sunjic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Ivan Toney",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Ivor Pandur",
    "country": "Croacia",
    "role": "gk"
  },
  {
    "name": "Jack Hendry",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Jackson Irvine",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Jackson Porozo",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Jacob Italiano",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Jacob Shaffelburg",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Jacob Widell Zetterstrom",
    "country": "Suecia",
    "role": "gk"
  },
  {
    "name": "Jakhongir Urozov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Jalal Hassan",
    "country": "Irak",
    "role": "gk"
  },
  {
    "name": "Jaloliddin Masharipov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Jamal Musiala",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "James Rodríguez",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": "James Trafford",
    "country": "Inglaterra",
    "role": "gk"
  },
  {
    "name": "Jamie Leweling",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Jaminton Campaz",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": "Jamiro Monteiro",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Jamshid Iskanderov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Jan Kuchta",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Jan Paul van Hecke",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Jaouen Hadjam",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Jarell Quansah",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Jaroslav Zeleny",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Jason Geria",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Jassim Gaber",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Jayden Adams",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Jean Michaël Seri",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Jean-Kévin Duverne",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Jean-Philippe Mateta",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Jean-Ricner Bellegarde",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Jearl Margaritha",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Jefferson Lerma",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": "Jehad Thakri",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Jens Castrop",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Jens Petter Hauge",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Jeremy Antonisse",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Jeremy Arévalo",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Jérémy Doku",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Jerome Opoku",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Jesper Karlström",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Jesse Randall",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Jesús Gallardo",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Jindrich Stanek",
    "country": "Chequia",
    "role": "gk"
  },
  {
    "name": "Jiovany Ramos",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Jo Hyun-Woo",
    "country": "Corea del Sur",
    "role": "gk"
  },
  {
    "name": "Jo Yu-Min",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Joan García",
    "country": "España",
    "role": "gk"
  },
  {
    "name": "João Cancelo",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "João Félix",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "João Neves",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Joao Paulo",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Joaquín Piquerez",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Joaquin Seys",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Joe Bell",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Joe Scally",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Joel Ordóñez",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Joel Waterman",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Johan Manzambi",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Johan Vásquez",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "John McGinn",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "John Souttar",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "John Stones",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "John Yeboah",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Johny Placide",
    "country": "Haití",
    "role": "gk"
  },
  {
    "name": "Jonas Adjetey",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Jonathan David",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Jonathan Osorio",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Jonathan Tah",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Jordan Ayew",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Jordan Bos",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Jordan Henderson",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Jordan Pickford",
    "country": "Inglaterra",
    "role": "gk"
  },
  {
    "name": "Jordy Alcívar",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Jordy Caicedo",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Jorge Carrascal",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": "Jorge Gutiérrez",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Jorge Sánchez",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Jørgen Strand Larsen",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Joris Kayembe",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Jorrel Hato",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Jose Canale",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "José Córdoba",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "José Fajardo",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "José Luis Rodríguez",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Jose Manuel López",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "José María Giménez",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "José Sá",
    "country": "Portugal",
    "role": "gk"
  },
  {
    "name": "Joseph Anang",
    "country": "Ghana",
    "role": "gk"
  },
  {
    "name": "Joshua Brenet",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Joshua Kimmich",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Josip Stanisic",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Josip Sutalo",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Josko Gvardiol",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Josué Casimir",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Josue Duverger",
    "country": "Haití",
    "role": "gk"
  },
  {
    "name": "Jovane Cabral",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Jovo Lukic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Juan Caceres",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Juan Camilo Hernández",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": "Juan Camilo Portilla",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": "Juan Fernando Quintero",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": "Juan Manuel Sanabria",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Juan Musso",
    "country": "Argentina",
    "role": "gk"
  },
  {
    "name": "Jude Bellingham",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Jules Koundé",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Julián Álvarez",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Julián Quiñones",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Julian Ryerson",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Julio Enciso",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Juninho Bacuna",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Júnior Alonso",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Junnosuke Suzuki",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Junya Ito",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Jürgen Locadia",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Juriën Gaari",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Jurriën Timber",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Justin Kluivert",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Kaan Ayhan",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Kai Havertz",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Kai Trewin",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Kaishu Sano",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Kalidou Koulibaly",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Kamal Deen Sulemana",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Kamogelo Sebelebele",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Karem Akturkoglu",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Karim Boudiaf",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Karim Hafez",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Keeto Thermoncy",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Keisuke Goto",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Keisuke Osako",
    "country": "Japón",
    "role": "gk"
  },
  {
    "name": "Keito Nakamura",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Kelvin Pires",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Ken Sema",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Kenan Yildiz",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Kendry Páez",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Kenji Gorré",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Kenny McLean",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Kento Shiogai",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Kerim Alajbegovic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Kevin Castaño",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": "Kevin Danso",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Kevin De Bruyne",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Kevin Felida",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Kevin Pina",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Kevin Rodríguez",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Kevin Yakob",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Khalid Al Ghannam",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Khalil Ayari",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Khojiakbar Alijonov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Khuliso Mudau",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Khulumani Ndamane",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Kieran Tierney",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Kim Jin-Kyu",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Kim Min-Jae",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Kim Moon-Hwan",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Kim Seung-Gyu",
    "country": "Corea del Sur",
    "role": "gk"
  },
  {
    "name": "Kim Tae-Hyun",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Knosinathi Sibisi",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Ko Itakura",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Kobbie Mainoo",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Kojo Oppong Peprah",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Koki Ogawa",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Koni De Winter",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Konrad Laimer",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Kosta Barbarouses",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Krépin Diatta",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Kristian Thorstvedt",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Kristijan Jakic",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Kristoffer Ajer",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Kristoffer Nordfeldt",
    "country": "Suecia",
    "role": "gk"
  },
  {
    "name": "Kwasi Sibo",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Kylian Mbappé",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Lachlan Bayliss",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Ladislav Krejcí",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Lamine Camara",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Lamine Yamal",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Laros Duarte",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Lautaro Martínez",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Lawrence Ati-Zigi",
    "country": "Ghana",
    "role": "gk"
  },
  {
    "name": "Lawrence Shankland",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Leandro Bacuna",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Leandro Paredes",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Leandro Trossard",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Lee Dong-Gyeong",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Lee Han-Beom",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Lee Jae-Sung",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Lee Kang-In",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Lee Ki-Hyeok",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Lee Tae-Seok",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Lennart Karl",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Lenny Joseph",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Leo Østigard",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Léo Pereira",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Leon Goretzka",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Leonardo Balerdi",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Leroy Sané",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Leverton Pierre",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Lewis Ferguson",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Liam Kelly",
    "country": "Escocia",
    "role": "gk"
  },
  {
    "name": "Liam Millar",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Liberato Cacace",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Lionel Messi",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Lionel Mpasi",
    "country": "RD Congo",
    "role": "gk"
  },
  {
    "name": "Lisandro Martínez",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Livano Comenencia",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Logan Costa",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Luc de Fougerolles",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Luca Jaquez",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Luca Zidane",
    "country": "Argelia",
    "role": "gk"
  },
  {
    "name": "Lucas Bergvall",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Lucas Digne",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Lucas Hernández",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Lucas Herrington",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Lucas Mendes",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Lucas Paquetá",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Luis Chávez",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Luis Díaz",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": "Luis Mejía",
    "country": "Panamá",
    "role": "gk"
  },
  {
    "name": "Luis Romo",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Luis Suárez",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": "Luiz Henrique",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Luka Modric",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Luka Sucic",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Luka Vuskovic",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Lukás Cerv",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Lukás Hornícek",
    "country": "Chequia",
    "role": "gk"
  },
  {
    "name": "Lukás Provod",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Lyle Foster",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Lyndon Dykes",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Maghnes Akliouche",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Mahmoud Abunada",
    "country": "Catar",
    "role": "gk"
  },
  {
    "name": "Mahmoud Al-Mardi",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Mahmoud Saber",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Mahmoud Trezeguet",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Malick Thiaw",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Malik Tillman",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Malo Gusto",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Mamadou Sarr",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Manaf Younis",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Manu Koné",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Manuel Akanji",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Manuel Neuer",
    "country": "Alemania",
    "role": "gk"
  },
  {
    "name": "Manuel Ugarte",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Marc Cucurella",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Marc Guéhi",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Marc Pubill",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Marcel Sabitzer",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Marcelo Flores",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Marcio Rosa",
    "country": "Cabo Verde",
    "role": "gk"
  },
  {
    "name": "Marco Friedl",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Marco Pasalic",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Marcos Llorente",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Marcus Pedersen",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Marcus Rashford",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Marcus Thuram",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Marin Pongracic",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Mario Pasalic",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Mark Flekken",
    "country": "Países Bajos",
    "role": "gk"
  },
  {
    "name": "Mark McKenzie",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Marko Arnautovic",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Marko Farji",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Marko Stamenic",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Marquinhos",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Marten de Roon",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Martin Baturina",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Martin Erlic",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Martin Expérience",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Martin Ødegaard",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Martin Zlomislic",
    "country": "Bosnia y Herzegovina",
    "role": "gk"
  },
  {
    "name": "Martín Zubimendi",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Marvin Keller",
    "country": "Suiza",
    "role": "gk"
  },
  {
    "name": "Marvin Senaya",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Marwan Ateya",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Matej Kovár",
    "country": "Chequia",
    "role": "gk"
  },
  {
    "name": "Mateo Chávez",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Mateo Kovacic",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Matheus Cunha",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Matheus Nunes",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Mathew Leckie",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Mathew Ryan",
    "country": "Australia",
    "role": "gk"
  },
  {
    "name": "Mathías Olivera",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Mathieu Choinière",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Matias Fernandez-Pardo",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Matías Galarza",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Matías Viña",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Mats Wieffer",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Matt Freese",
    "country": "Estados Unidos",
    "role": "gk"
  },
  {
    "name": "Matt Garbett",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Matt Turner",
    "country": "Estados Unidos",
    "role": "gk"
  },
  {
    "name": "Matthieu Epolo",
    "country": "RD Congo",
    "role": "gk"
  },
  {
    "name": "Mattias Svanberg",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Mauricio Magalhaes",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Max Arfsten",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Max Crocombe",
    "country": "Nueva Zelanda",
    "role": "gk"
  },
  {
    "name": "Maxence Lacroix",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Maxim De Cuyper",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Maxime Crépeau",
    "country": "Canadá",
    "role": "gk"
  },
  {
    "name": "Maximilian Beier",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Maximiliano Araújo",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Mbekezeli Mbokazi",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Mehdi Ghaedi",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Mehdi Torabi",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Melvin Masstil",
    "country": "Argelia",
    "role": "gk"
  },
  {
    "name": "Memphis Depay",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Merchas Doski",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Merih Demiral",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Mert Günok",
    "country": "Turquía",
    "role": "gk"
  },
  {
    "name": "Mert Müldür",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Meschak Elia",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Meshaal Barsham",
    "country": "Catar",
    "role": "gk"
  },
  {
    "name": "Michael Boxall",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Michael Gregoritsch",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Michael Olise",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Michael Svoboda",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Michael Woud",
    "country": "Nueva Zelanda",
    "role": "gk"
  },
  {
    "name": "Michal Sadílek",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Michel Aebischer",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Micky van de Ven",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Miguel Almirón",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Mike Maignan",
    "country": "Francia",
    "role": "gk"
  },
  {
    "name": "Mike Penders",
    "country": "Bélgica",
    "role": "gk"
  },
  {
    "name": "Mikel Merino",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Mikel Oyarzabal",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Milad Mohammadi",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Miles Robinson",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Milos Degenek",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Miro Muheim",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Mohamed Abdelmonemn",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Mohamed Al Owais",
    "country": "Arabia Saudita",
    "role": "gk"
  },
  {
    "name": "Mohamed Alaa",
    "country": "Egipto",
    "role": "gk"
  },
  {
    "name": "Mohamed Amine Amoura",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Mohamed Amine Ben Hamida",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Mohamed Amine Tougai",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Mohamed El Shenawy",
    "country": "Egipto",
    "role": "gk"
  },
  {
    "name": "Mohamed Hany",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Mohamed Kanno",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Mohamed Koné",
    "country": "Costa de Marfil",
    "role": "gk"
  },
  {
    "name": "Mohamed Salah",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Mohamed Toure",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Mohammad Abu Hasheesh",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Mohammad Abu Zrayq",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Mohammad Abualnadi",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Mohammad Al-Dawoud",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Mohammad Ghorbani",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Mohammad Mohebi",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Mohammed Abu Alshamat",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Mohammed Mannai",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Mohammed Muntari",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Mohammed Waad",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Mohanad Ali",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Mohanad Lasheen",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Mohannad Abu Taha",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Moïse Bombito",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Moisés Caicedo",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Moisés Ramírez",
    "country": "Ecuador",
    "role": "gk"
  },
  {
    "name": "Mojmír Chytil",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Montassar Talbi",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Morgan Rogers",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Mortadha Ben Ouanes",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Morten Thorsby",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Mory Diaw",
    "country": "Senegal",
    "role": "gk"
  },
  {
    "name": "Mostafa Shobeir",
    "country": "Egipto",
    "role": "gk"
  },
  {
    "name": "Mostafa Ziko",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Moteb Al Harbi",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Mousa Tamari",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Moussa Niakhaté",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Moutaz Neffati",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Mubarak Shannan",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Munir Kajoui",
    "country": "Marruecos",
    "role": "gk"
  },
  {
    "name": "Murillo",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Musab Al Juwayr",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Mustafa Saadoon",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "N'Golo Kanté",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Nabil Bentaleb",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Nabil Emad",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Nadiem Amiri",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Nadir Benbouali",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Nahuel Molina",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Nando Pijnaker",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Nasser Al Dawsari",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Nathan Aké",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Nathan Ngoy",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Nathan Patterson",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Nathan Saliba",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Nathanaël Mbuku",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Nathaniel Brown",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Nawaf Al Aqidi",
    "country": "Arabia Saudita",
    "role": "gk"
  },
  {
    "name": "Nawaf Boushal",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Nayef Aguerd",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Neil El Aynaoui",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Nélson Semedo",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Nestory Irankunda",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Neymar",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Ngal'ayel Mukau",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Niall Mason",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Nick Woltemade",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Nico Elvedi",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Nico O'Reilly",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Nico Paz",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Nico Schlotterbeck",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Nico Williams",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Nicolás De La Cruz",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Nicolás González",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Nicolas Jackson",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Nicolás Otamendi",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Nicolas Pépé",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Nicolas Raskin",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Nicolas Seiwald",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Nicolás Tagliafico",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Nidal Celik",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Nihad Mujakic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Niko Sigur",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Nikola Katic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Nikola Moro",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Nikola Vasilj",
    "country": "Bosnia y Herzegovina",
    "role": "gk"
  },
  {
    "name": "Nikola Vlasic",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Nilson Angulo",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Nishan Velupillay",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Nizar Al-Rashdan",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Noa Lang",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Noah Okafor",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Noah Sadiki",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Noni Madueke",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Noor Al-Rawabdeh",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Nour Bani Attiah",
    "country": "Jordania",
    "role": "gk"
  },
  {
    "name": "Noussair Mazraoui",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Nuno da Costa",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Nuno Mendes",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Obed Vargas",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Odeh Fakhoury",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Odiljon Xamrobejov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Odilon Kossounou",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Oguz Aydin",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Oh Hyun-Kyu",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Oliver Baumann",
    "country": "Alemania",
    "role": "gk"
  },
  {
    "name": "Ollie Watkins",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Olwethu Makhanya",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Omar Alderete",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Omar Marmoush",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Omar Rekik",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Orbelín Pineda",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Ørjan Nyland",
    "country": "Noruega",
    "role": "gk"
  },
  {
    "name": "Orkun Kökçü",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Orlando Gill",
    "country": "Paraguay",
    "role": "gk"
  },
  {
    "name": "Orlando Mosquera",
    "country": "Panamá",
    "role": "gk"
  },
  {
    "name": "Oscar Bobb",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Osman Hadzikic",
    "country": "Bosnia y Herzegovina",
    "role": "gk"
  },
  {
    "name": "Oston Uronov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Oswin Appollis",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Otabek Shukurov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Oumar Diakité",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Ousmane Diomande",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Oussama Benbot",
    "country": "Argelia",
    "role": "gk"
  },
  {
    "name": "Owen Goodman",
    "country": "Canadá",
    "role": "gk"
  },
  {
    "name": "Ozan Kabak",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Paik Seung-Ho",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Pape Gueye",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Pape Matar Sarr",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Parfait Guiagon",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Park Jin-Seop",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Pascal Gross",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Pathé Ciss",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Patrick Beach",
    "country": "Australia",
    "role": "gk"
  },
  {
    "name": "Patrick Berg",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Patrick Pentz",
    "country": "Austria",
    "role": "gk"
  },
  {
    "name": "Patrick Wimmer",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Patrik Schick",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Pau Cubarsí",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Paul Izzo",
    "country": "Australia",
    "role": "gk"
  },
  {
    "name": "Paul Okon",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Paul Wanner",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Pavel Sulc",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Payam Niazmand",
    "country": "Irán",
    "role": "gk"
  },
  {
    "name": "Pedri",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Pedro Miguel",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Pedro Neto",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Pedro Porro",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Pedro Vite",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Pervis Estupiñán",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Petar Musa",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Petar Sucic",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Philipp Lienhart",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Philipp Mwene",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Pico",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Piero Hincapié",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Prince Kwabena Adu",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Promise David",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Quinten Timber",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Raed Chikhaoui",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Rafael Leão",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Rafik Belghali",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Rajaei Ayed",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Rami Rabia",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Ramin Rezaeian",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Ramiz Zerrouki",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Ramón Sosa",
    "country": "Paraguay",
    "role": "outfield"
  },
  {
    "name": "Ramy Bensebaini",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Rani Khedira",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Raphinha",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Raúl Jiménez",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Raúl Rangel",
    "country": "México",
    "role": "gk"
  },
  {
    "name": "Rayan",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Rayan Ait Nouri",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Rayan Cherki",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Rayan Elloumi",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Rebin Sulaka",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Reda Tagnaouti",
    "country": "Marruecos",
    "role": "gk"
  },
  {
    "name": "Redouane Halhal",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Reece James",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Relebohile Mokofoeng",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Remo Freuler",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Renato Veiga",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Ricardo Adé",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Ricardo Goss",
    "country": "Sudáfrica",
    "role": "gk"
  },
  {
    "name": "Ricardo Pepi",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Ricardo Rodríguez",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Ricardo Velho",
    "country": "Portugal",
    "role": "gk"
  },
  {
    "name": "Richard Ríos",
    "country": "Colombia",
    "role": "outfield"
  },
  {
    "name": "Richie Laryea",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Riechedly Bazoer",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Ritsu Doan",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Riyad Mahrez",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Roberto Alvarado",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Roberto Fernández",
    "country": "Paraguay",
    "role": "gk"
  },
  {
    "name": "Robin Hranác",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Robin Risser",
    "country": "Francia",
    "role": "gk"
  },
  {
    "name": "Robin Roefs",
    "country": "Países Bajos",
    "role": "gk"
  },
  {
    "name": "Roderick Miller",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Rodri",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Rodrigo Aguirre",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Rodrigo Bentancur",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Rodrigo De Paul",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Rodrigo Zalazar",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Roger Ibañez",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Romano Schmid",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Romelu Lukaku",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Ronald Araújo",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Ronwen Williams",
    "country": "Sudáfrica",
    "role": "gk"
  },
  {
    "name": "Roshon van Eijma",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Ross Stewart",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Rouzbeh Cheshmi",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Rúben Dias",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Rúben Neves",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Ruben Providence",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Rubén Vargas",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Rui Silva",
    "country": "Portugal",
    "role": "gk"
  },
  {
    "name": "Rustam Ashurmatov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Ryan Christie",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Ryan Gravenberch",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Ryan Mendes",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Ryan Thomas",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Sabri Ben Hessen",
    "country": "Túnez",
    "role": "gk"
  },
  {
    "name": "Sadio Mané",
    "country": "Senegal",
    "role": "outfield"
  },
  {
    "name": "Saed Al-Rosan",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Saeid Ezatolahi",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Salah Zakaria",
    "country": "Catar",
    "role": "gk"
  },
  {
    "name": "Saleem Obaid",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Saleh Al Shehri",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Saleh Hardani",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Salem Al Dawsari",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Salih Özcan",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Saman Ghoddos",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Samed Bazdar",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Samet Akaydin",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Samir Chergui",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Samir El Mourabet",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Samú Costa",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Samuel Moutoussamy",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Samukele Kabini",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Sander Berge",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Sander Tangvik",
    "country": "Noruega",
    "role": "gk"
  },
  {
    "name": "Santiago Bueno",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Santiago Gimenez",
    "country": "México",
    "role": "outfield"
  },
  {
    "name": "Santiago Mele",
    "country": "Uruguay",
    "role": "gk"
  },
  {
    "name": "Santos",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Sarpreet Singh",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Sasa Kalajdzic",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Saud Abdulhamid",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Scott McKenna",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Scott McTominay",
    "country": "Escocia",
    "role": "outfield"
  },
  {
    "name": "Sead Kolasinac",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Sebastian Berhalter",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Sebastián Cáceres",
    "country": "Uruguay",
    "role": "outfield"
  },
  {
    "name": "Sebastian Tounekti",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Seko Fofana",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Senne Lammens",
    "country": "Bélgica",
    "role": "gk"
  },
  {
    "name": "Seol Young-Woo",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Sergiño Dest",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Sergio Rochet",
    "country": "Uruguay",
    "role": "gk"
  },
  {
    "name": "Shahriyar Moghanloo",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Sherel Floranus",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Sherzod Esanov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Sherzod Nasrullaev",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Shogo Taniguchi",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Shoka Khalilzadeh",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Shurandy Sambo",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Sidny Lopes Cabral",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Silvan Widmer",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Simon Adingra",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Simon Banza",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Sipho Chaine",
    "country": "Sudáfrica",
    "role": "gk"
  },
  {
    "name": "Sofyan Amrabat",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Son Heung-Min",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Sondre Langås",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Song Bum-Keun",
    "country": "Corea del Sur",
    "role": "gk"
  },
  {
    "name": "Sontje Hansen",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Soufiane Rahimi",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Sphephelo Sithole",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Stefan Posch",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Stepán Chaloupek",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Stephen Eustáquio",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Steve Kapuadi",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Steven Moreira",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Stjepan Radeljic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Stopira",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Sultan Al Brake",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Sultan Mandash",
    "country": "Arabia Saudita",
    "role": "outfield"
  },
  {
    "name": "Taha Ali",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Tahith Chong",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Tahsin Mohammed",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Tajon Buchanan",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Takefusa Kubo",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Takehiro Tomiyasu",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Tani Oluwaseyi",
    "country": "Canadá",
    "role": "outfield"
  },
  {
    "name": "Tarek Alaa",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Taremi",
    "country": "Irán",
    "role": "outfield"
  },
  {
    "name": "Tarik Muharemovic",
    "country": "Bosnia y Herzegovina",
    "role": "outfield"
  },
  {
    "name": "Teboho Mokoena",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Telmo Arcanjo",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Tete Yengi",
    "country": "Australia",
    "role": "outfield"
  },
  {
    "name": "Teun Koopmeiners",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Thabang Matuludi",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Thalente Mbatha",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Thapelo Maseko",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Thelo Aasgaard",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Themba Zwane",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Théo Bongonda",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Theo Hernández",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Thiago Almada",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Thibaut Courtois",
    "country": "Bélgica",
    "role": "gk"
  },
  {
    "name": "Thomas Meunier",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Thomas Partey",
    "country": "Ghana",
    "role": "outfield"
  },
  {
    "name": "Tijjani Reijnders",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Tim Payne",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Tim Ream",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Tim Weah",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Timothy Castagne",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Timothy Fayulu",
    "country": "RD Congo",
    "role": "gk"
  },
  {
    "name": "Tino Livramento",
    "country": "Inglaterra",
    "role": "outfield"
  },
  {
    "name": "Tomás Araújo",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Tomás Chory",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Tomás Holes",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Tomás Rodríguez",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Tomás Soucek",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Tommy Smith",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Tomoki Hayakawa",
    "country": "Japón",
    "role": "gk"
  },
  {
    "name": "Toni Fruk",
    "country": "Croacia",
    "role": "outfield"
  },
  {
    "name": "Torbjørn Heggem",
    "country": "Noruega",
    "role": "outfield"
  },
  {
    "name": "Trevor Doornbusch",
    "country": "Curazao",
    "role": "gk"
  },
  {
    "name": "Tshepang Moremi",
    "country": "Sudáfrica",
    "role": "outfield"
  },
  {
    "name": "Tsuyoshi Watanabe",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Tyler Adams",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Tyler Bindon",
    "country": "Nueva Zelanda",
    "role": "outfield"
  },
  {
    "name": "Tyrese Noslin",
    "country": "Curazao",
    "role": "outfield"
  },
  {
    "name": "Tyrick Bodak",
    "country": "Curazao",
    "role": "gk"
  },
  {
    "name": "Ugurcan Çakir",
    "country": "Turquía",
    "role": "gk"
  },
  {
    "name": "Um Ji-Sung",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Umar Eshmurodov",
    "country": "Uzbekistán",
    "role": "outfield"
  },
  {
    "name": "Unai Simón",
    "country": "España",
    "role": "gk"
  },
  {
    "name": "Utkir Yusupov",
    "country": "Uzbekistán",
    "role": "gk"
  },
  {
    "name": "Valentín Barco",
    "country": "Argentina",
    "role": "outfield"
  },
  {
    "name": "Victor Lindelöf",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Víctor Muñoz",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Viktor Gyökeres",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Viktor Johansson",
    "country": "Suecia",
    "role": "gk"
  },
  {
    "name": "Vinícius Júnior",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Virgil van Dijk",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Vitinha",
    "country": "Portugal",
    "role": "outfield"
  },
  {
    "name": "Vladimír Coufal",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Vladimír Darida",
    "country": "Chequia",
    "role": "outfield"
  },
  {
    "name": "Vozinha",
    "country": "Cabo Verde",
    "role": "gk"
  },
  {
    "name": "Wagner Pina",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Waldemar Anton",
    "country": "Alemania",
    "role": "outfield"
  },
  {
    "name": "Warren Zaïre-Emery",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Wataru Endo",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Wesley",
    "country": "Brasil",
    "role": "outfield"
  },
  {
    "name": "Weston McKennie",
    "country": "Estados Unidos",
    "role": "outfield"
  },
  {
    "name": "Weverton",
    "country": "Brasil",
    "role": "gk"
  },
  {
    "name": "Wilfried Singo",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Wilguens Paugain",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "William Saliba",
    "country": "Francia",
    "role": "outfield"
  },
  {
    "name": "Willian Pacho",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Willy Semedo",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Wilson Isidor",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Woodensky Pierre",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Wout Weghorst",
    "country": "Países Bajos",
    "role": "outfield"
  },
  {
    "name": "Xaver Schlager",
    "country": "Austria",
    "role": "outfield"
  },
  {
    "name": "Yahia Fofana",
    "country": "Costa de Marfil",
    "role": "gk"
  },
  {
    "name": "Yaimar Medina",
    "country": "Ecuador",
    "role": "outfield"
  },
  {
    "name": "Yan Diomande",
    "country": "Costa de Marfil",
    "role": "outfield"
  },
  {
    "name": "Yan Valery",
    "country": "Túnez",
    "role": "outfield"
  },
  {
    "name": "Yang Hyun-Jun",
    "country": "Corea del Sur",
    "role": "outfield"
  },
  {
    "name": "Yannick Semedo",
    "country": "Cabo Verde",
    "role": "outfield"
  },
  {
    "name": "Yasin Ayari",
    "country": "Suecia",
    "role": "outfield"
  },
  {
    "name": "Yasser Ibrahim",
    "country": "Egipto",
    "role": "outfield"
  },
  {
    "name": "Yassin Fortuné",
    "country": "Haití",
    "role": "outfield"
  },
  {
    "name": "Yassine Bounou",
    "country": "Marruecos",
    "role": "gk"
  },
  {
    "name": "Yassine Titraoui",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Yazan Al-Arab",
    "country": "Jordania",
    "role": "outfield"
  },
  {
    "name": "Yazid Abulaila",
    "country": "Jordania",
    "role": "gk"
  },
  {
    "name": "Yehvann Diouf",
    "country": "Senegal",
    "role": "gk"
  },
  {
    "name": "Yéremy Pino",
    "country": "España",
    "role": "outfield"
  },
  {
    "name": "Yoane Wissa",
    "country": "RD Congo",
    "role": "outfield"
  },
  {
    "name": "Yoel Bárcenas",
    "country": "Panamá",
    "role": "outfield"
  },
  {
    "name": "Youri Tielemans",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Youssef Amyn",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Youssef Belammari",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Yuito Suzuki",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Yukinari Sugawara",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Yunus Akgün",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Yusuf Abdurisag",
    "country": "Catar",
    "role": "outfield"
  },
  {
    "name": "Yūto Nagatomo",
    "country": "Japón",
    "role": "outfield"
  },
  {
    "name": "Yvon Mvogo",
    "country": "Suiza",
    "role": "gk"
  },
  {
    "name": "Zaid Ismail",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Zaid Tahseen",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Zakaria El Ouahdi",
    "country": "Marruecos",
    "role": "outfield"
  },
  {
    "name": "Zeki Amdouni",
    "country": "Suiza",
    "role": "outfield"
  },
  {
    "name": "Zeki Çelik",
    "country": "Turquía",
    "role": "outfield"
  },
  {
    "name": "Zeno Debast",
    "country": "Bélgica",
    "role": "outfield"
  },
  {
    "name": "Zidane Iqbal",
    "country": "Irak",
    "role": "outfield"
  },
  {
    "name": "Zinedine Belaid",
    "country": "Argelia",
    "role": "outfield"
  },
  {
    "name": "Zion Suzuki",
    "country": "Japón",
    "role": "gk"
  },
  {
    "name": "Ziyad Al Johani",
    "country": "Arabia Saudita",
    "role": "outfield"
  }
];

/** Porteros convocados (orden alfabético). */
export const AWARD_GOALKEEPERS = [
  ": Álvaro Montero",
  "Abdallah Al-Fakhouri",
  "Abdelmouhib Chamakh",
  "Abduvakhid Nematov",
  "Ahmed",
  "Ahmed Alkassar",
  "Ahmed Basil",
  "Alban Lafont",
  "Alex Paulsen",
  "Alexander Nübel",
  "Alexander Schlager",
  "Alexandre Pierre",
  "Alireza Beiranvand",
  "Alisson",
  "Altay Bayindir",
  "Angus Gunn",
  "Aymen Dahmen",
  "Bart Verbruggen",
  "Benjamin Asare",
  "Botirali Ergashev",
  "Brice Samba",
  "Camilo Vargas",
  "Carlos Acevedo",
  "César Samudio",
  "Chris Brady",
  "CJ dos Santos",
  "Craig Gordon",
  "David Ospina",
  "David Raya",
  "Dayne St. Clair",
  "Dean Henderson",
  "Diogo Costa",
  "Dominik Kotarski",
  "Dominik Livakovic",
  "Éderson",
  "Édouard Mendy",
  "Egil Selvik",
  "El Mahdi Soliman",
  "Eloy Room",
  "Emiliano Martínez",
  "Fahad Talib",
  "Fernando Muslera",
  "Florian Wiegele",
  "Gastón Olveira",
  "Gerónimo Rulli",
  "Gonzalo Valle",
  "Gregor Kobel",
  "Guillermo Ochoa",
  "Hernán Galíndez",
  "Hossein Hosseini",
  "Ivor Pandur",
  "Jacob Widell Zetterstrom",
  "Jalal Hassan",
  "James Trafford",
  "Jindrich Stanek",
  "Jo Hyun-Woo",
  "Joan García",
  "Johny Placide",
  "Jordan Pickford",
  "José Sá",
  "Joseph Anang",
  "Josue Duverger",
  "Juan Musso",
  "Keisuke Osako",
  "Kim Seung-Gyu",
  "Kristoffer Nordfeldt",
  "Lawrence Ati-Zigi",
  "Liam Kelly",
  "Lionel Mpasi",
  "Luca Zidane",
  "Luis Mejía",
  "Lukás Hornícek",
  "Mahmoud Abunada",
  "Manuel Neuer",
  "Marcio Rosa",
  "Mark Flekken",
  "Martin Zlomislic",
  "Marvin Keller",
  "Matej Kovár",
  "Mathew Ryan",
  "Matt Freese",
  "Matt Turner",
  "Matthieu Epolo",
  "Max Crocombe",
  "Maxime Crépeau",
  "Melvin Masstil",
  "Mert Günok",
  "Meshaal Barsham",
  "Michael Woud",
  "Mike Maignan",
  "Mike Penders",
  "Mohamed Al Owais",
  "Mohamed Alaa",
  "Mohamed El Shenawy",
  "Mohamed Koné",
  "Moisés Ramírez",
  "Mory Diaw",
  "Mostafa Shobeir",
  "Munir Kajoui",
  "Nawaf Al Aqidi",
  "Nikola Vasilj",
  "Nour Bani Attiah",
  "Oliver Baumann",
  "Ørjan Nyland",
  "Orlando Gill",
  "Orlando Mosquera",
  "Osman Hadzikic",
  "Oussama Benbot",
  "Owen Goodman",
  "Patrick Beach",
  "Patrick Pentz",
  "Paul Izzo",
  "Payam Niazmand",
  "Raúl Rangel",
  "Reda Tagnaouti",
  "Ricardo Goss",
  "Ricardo Velho",
  "Roberto Fernández",
  "Robin Risser",
  "Robin Roefs",
  "Ronwen Williams",
  "Rui Silva",
  "Sabri Ben Hessen",
  "Salah Zakaria",
  "Sander Tangvik",
  "Santiago Mele",
  "Senne Lammens",
  "Sergio Rochet",
  "Sipho Chaine",
  "Song Bum-Keun",
  "Thibaut Courtois",
  "Timothy Fayulu",
  "Tomoki Hayakawa",
  "Trevor Doornbusch",
  "Tyrick Bodak",
  "Ugurcan Çakir",
  "Unai Simón",
  "Utkir Yusupov",
  "Viktor Johansson",
  "Vozinha",
  "Weverton",
  "Yahia Fofana",
  "Yassine Bounou",
  "Yazid Abulaila",
  "Yehvann Diouf",
  "Yvon Mvogo",
  "Zion Suzuki"
];

/** Jugadores de campo convocados (orden alfabético). */
export const AWARD_OUTFIELD_PLAYERS = [
  "-Engstler",
  ": Akmal Mozgovoy",
  ": Jhon Arias",
  ": Jhon Córdoba",
  ":Eldor Shomurodov",
  "Aaron Hickey",
  "Aaron Tshibola",
  "Aaron Wan-Bissaka",
  "Abbosbek Fayzullaev",
  "Abdallah Nasib",
  "Abde Ezzalzouli",
  "Abdoulaye Seck",
  "Abdul",
  "Abdul Mumin",
  "Abdulaziz Hatem",
  "Abdulelah Al Amri",
  "Abdülkerim Bardakci",
  "Abdulla Abdullaev",
  "Abdullah Al Hamdan",
  "Abdullah Al Khaibari",
  "Achraf Abada",
  "Achraf Hakimi",
  "Adalberto Carrasquilla",
  "Adam Arous",
  "Adam Hlozek",
  "Adil Boulbina",
  "Adrien Rabiot",
  "Agustín Canobbio",
  "Ahmed Alaa",
  "Ahmed Fathi",
  "Ahmed Fatouh",
  "Ahmed Qasem",
  "Ahmed Yahya",
  "Ahmed Zizo",
  "Ahmetcan Kaplan",
  "Aiden O’Neill",
  "Aimar Sher",
  "Aïssa Mandi",
  "Ajdin Hrustic",
  "Akam Hashim",
  "Akram Afif",
  "Al-Hashmi Al-Hussain",
  "Alaa Al Hejji",
  "Alan Franco",
  "Alan Minda",
  "Alberto Quintero",
  "Alejandro Romero Gamarra 'Kaku'",
  "Alejandro Zendejas",
  "Aleksandar Pavlovic",
  "Alessandro Circati",
  "Alessandro Schopf",
  "Alex Arce",
  "Álex Baena",
  "Alex Freeman",
  "Álex Grimaldo",
  "Alex Rufer",
  "Alex Sandro",
  "Alexander Bernhardsson",
  "Alexander Djiku",
  "Alexander Isak",
  "Alexander Prass",
  "Alexander Sørloth",
  "Alexandr Sojka",
  "Alexandro Maidana",
  "Alexis Mac Allister",
  "Alexis Saelemaekers",
  "Alexis Vega",
  "Alfie Jones",
  "Ali Abdi",
  "Ali Ahmed",
  "Ali Al-Hamadi",
  "Ali Alipour",
  "Ali Azaizeh",
  "Ali Jassim",
  "Ali Lajami",
  "Ali Majrashi",
  "Ali Nemati Omid Noorafkan",
  "Ali Olwan",
  "Ali Yousef",
  "Alidu Seidu",
  "Alireza Jahanbakhsh",
  "Alistair Johnston",
  "Almoez Ali",
  "Alphonso Davies",
  "Álvaro Fidalgo",
  "Amad Diallo",
  "Amadou Onana",
  "Amar Dedic",
  "Amar Memic",
  "Amer Jamous",
  "Amine Gouiri",
  "Amir",
  "Amir Al-Ammari",
  "Amir Hadziahmetovic",
  "Amir Mohammad Razzaghinia",
  "Amirhossein Hosseinzadeh",
  "Anas Badawi",
  "Anass Salah-Eddine",
  "Andreas Schjelderup",
  "Andrej Kramaric",
  "Andrés Andrade",
  "Andrés Cubas",
  "Andy Robertson",
  "Ange-Yoan Bonny",
  "Ángelo Preciado",
  "Angelo Stiller",
  "Aníbal Godoy",
  "Anis Ben Slimane",
  "Anis Hadj Moussa",
  "Ante Budimir",
  "Anthony",
  "Anthony Elanga",
  "Anthony Gordon",
  "Anthony Ralston",
  "Antoine Mendy",
  "Antoine Semenyo",
  "Antonee Robinson",
  "Antonio Nusa",
  "Antonio Rüdiger",
  "Antonio Sanabria",
  "Ao Tanaka",
  "Aqtay Abdallah",
  "Ar'jany Martha",
  "Aral Simsir",
  "Arda Güler",
  "Ardon Jashari",
  "Aria Yousefi",
  "Armando González",
  "Armando Obispo",
  "Armin Gigovic",
  "Arthur Masuaku",
  "Arthur Theate",
  "Assane Diao",
  "Assim Madibo",
  "Aubrey Modiba",
  "Augustine Boakye",
  "Aurèle Amenda",
  "Aurélien Tchouaméni",
  "Auston Trusty",
  "Avazbek Ulmasaliyev",
  "Awer Mabil",
  "Axel Tuanzebe",
  "Axel Witsel",
  "Ayase Ueda",
  "Ayman Yahya",
  "Aymen Hussein",
  "Aymeric Laporte",
  "Ayoub Al-Alawi",
  "Ayoub El Kaabi",
  "Ayoube Amaimouni",
  "Ayumu Seko",
  "Ayyoub Bouaddi",
  "Azarias Londoño",
  "Aziz Behich",
  "Azizbek Amonov",
  "Azizjon Amonov",
  "Azzedine Ounahi",
  "Baba Abdul Rahman",
  "Bae Jun-Ho",
  "Balil El Khannouss",
  "Bamba Dieng",
  "Bara Sapoko Ndiaye",
  "Baris Alper Yilmaz",
  "Bazoumana Touré",
  "Behruzjon Karimov",
  "Ben Gannon-Doak",
  "Ben Old",
  "Ben Waine",
  "Benjamin Nygren",
  "Benjamin Tahirovic",
  "Bernardo Silva",
  "Besfort Zeneli",
  "Billy Gilmour",
  "Borja Iglesias",
  "Bradley Barcola",
  "Bradley Cross",
  "Brahim Díaz",
  "Braian Ojeda",
  "Brandley Kuwas",
  "Brandon Mechele",
  "Brandon Thomas-Asante",
  "Breel Embolo",
  "Bremer",
  "Brenden Aaronson",
  "Brian Brobbey",
  "Brian Cipenga",
  "Brian Gutiérrez",
  "Brian Rodríguez",
  "Bruno Fernandes",
  "Bruno Guimarães",
  "Bukayo Saka",
  "Caglar Söyüncü",
  "Caleb Yirenkyi",
  "Callan Elliot",
  "Callum McCowatt",
  "Cameron Burgess",
  "Cameron Devlin",
  "Can Uzun",
  "Carl Fred Sainté",
  "Carl Starfelt",
  "Carlens Arcus",
  "Carlos Andrés Gómez",
  "Carlos Harvey",
  "Carney Chukwuemeka",
  "Casemiro",
  "Cecilio Waterman",
  "Cédric Bakambu",
  "Cedric Itten",
  "César Blackman",
  "César Huerta",
  "César Montes",
  "César Yanis",
  "Chadi Riad",
  "Chancel Mbemba",
  "Charles De Ketelaere",
  "Charles Pickel",
  "Ché Adams",
  "Chemsdine Talbi",
  "Cherif Ndiaye",
  "Cho Kyu-Sung",
  "Chris Richards",
  "Chris Wood",
  "Christ Inao Oulaï",
  "Christian Fassnacht",
  "Christian Pulisic",
  "Christoph Baumgartner",
  "Christopher Bonsu Baah",
  "Clément Akpa",
  "Cody Gakpo",
  "Connor Metcalfe",
  "Cristian Martínez",
  "Cristian Roldan",
  "Cristian Romero",
  "Cristian Volpato",
  "Cristiano Ronaldo",
  "Crysencio Summerville",
  "Cyle Larin",
  "Daichi Kamada",
  "Dailon Livramento",
  "Daizen Maeda",
  "Damián Bobadilla",
  "Dan Burn",
  "Dan Ndoye",
  "Dani Olmo",
  "Danial Eiri",
  "Daniel Svensson",
  "Danilo",
  "Danilo Santos",
  "Danley Jean Jacques",
  "Darwin Núñez",
  "David Affengruber",
  "David Alaba",
  "David Doudera",
  "David Jurásek",
  "David Møller Wolfe",
  "David Raum",
  "David Zima",
  "Dayot Upamecano",
  "Declan Rice",
  "Demir Ege Tiknaz",
  "Denil Castillo",
  "Denis Visinsky",
  "Denis Zakaria",
  "Deniz Gül",
  "Deniz Undav",
  "Dennis Dargahi",
  "Dennis Hadzikadunic",
  "Denzel Dumfries",
  "Derek Cornelius",
  "Deroy Duarte",
  "Derrick Etienne",
  "Desiré Doué",
  "Deveron Fonville",
  "Diego Gómez",
  "Diego Moreira",
  "Diney",
  "Diogo Dalot",
  "Djed Spence",
  "Djibril Sow",
  "Dodi Lukebakio",
  "Dom Hyam",
  "Dominique Simon",
  "Don Deedson Louicius",
  "Donyell Malen",
  "Dostonbek Khamdamov",
  "Douglas",
  "Duckens Nazon",
  "Duje Caleta-Car",
  "Duke Lacroix",
  "Dylan Batubinsika",
  "Dylan Bronn",
  "Dzenis Burnic",
  "Eberechi Eze",
  "Edgardo Fariña",
  "Edin Dzeko",
  "Edmílson Junior",
  "Edo Kayembe",
  "Edson álvarez",
  "Ehsan Haddad",
  "Ehsan Hajsafi",
  "El Hadji Malick Diouf",
  "Eli Just",
  "Elias Achouri",
  "Elias Saad",
  "Elisha Owusu",
  "Elliot Anderson",
  "Elliot Stroud",
  "Ellyes Skhiri",
  "Elye Wahi",
  "Emam Ashour",
  "Emil Holm",
  "Emiliano Martínez",
  "Emmanuel Agbadou",
  "Endrick",
  "Enner Valencia",
  "Enzo Fernández",
  "Eray Cömert",
  "Eren Elmali",
  "Éric Davis",
  "Eric García",
  "Erik Lira",
  "Erik Smith",
  "Erling Haaland",
  "Ermedin Demirovic",
  "Ermin Mahmic",
  "Ernest Nuamah",
  "Esmir Bajraktarevic",
  "Evan Ndicka",
  "Evann Guessand",
  "Evidence Makgopa",
  "Exequiel Palacios",
  "Ezri Konsa",
  "Fabián Balbuena",
  "Fabian Rieder",
  "Fabián Ruiz",
  "Fabinho",
  "Facundo Medina",
  "Facundo Pellistri",
  "Farès Chaïbi",
  "Fares Ghedjemis",
  "Farrukh Sayfiev",
  "Fatawu Issahaku",
  "Federico Valverde",
  "Federico Viñas",
  "Felix Nmecha",
  "Félix Torres",
  "Feras Al Brikan",
  "Ferdi Kadioglu",
  "Ferran Torres",
  "Fidel Escobar",
  "Finlay Curtis",
  "Finn Surman",
  "Firas Chaouat",
  "Fiston Mayele",
  "Florian Grillitsch",
  "Florian Wirtz",
  "Folarin Balogun",
  "Francis De Vries",
  "Francisco Conceição",
  "Francisco Trincão",
  "Franck Kessié",
  "Frans Putros",
  "Frantzdy Pierrot",
  "Fredrik André Bjørkan",
  "Fredrik Aursnes",
  "Frenkie de Jong",
  "Gabriel Avalos",
  "Gabriel Gudmundsson",
  "Gabriel Magalhães",
  "Gabriel Martinelli",
  "Gaël Kakuta",
  "Garry Rodrigues",
  "Gavi",
  "Gedeon Kalulu",
  "George Hirst",
  "Gervane Kastaneer",
  "Gessime Yassine",
  "Ghislain Konan",
  "Gideon Mensah",
  "Gilberto Mora",
  "Gilson Benchimol",
  "Gio Reyna",
  "Giorgian De Arrascaeta",
  "Giovani Lo Celso",
  "Giuliano Simeone",
  "Godfried Roemeratoe",
  "Gonçalo Guedes",
  "Gonçalo Inacio",
  "Gonçalo Ramos",
  "Gonzalo Montiel",
  "Gonzalo Plata",
  "Granit Xhaka",
  "Grant Hanley",
  "Guela Doué",
  "Guillermo Martínez",
  "Guillermo Varela",
  "Gustaf Lagerbielke",
  "Gustaf Nilsson",
  "Gustavo Caballero",
  "Gustavo Gómez",
  "Gustavo Puerta",
  "Gustavo Velázquez",
  "Guus Til",
  "Habib Diarra",
  "Hadj Mahmoud",
  "Haissem Hassan",
  "Haji Wright",
  "Hakan Çalhanoglu",
  "Hamdy Fathy",
  "Hamza Abdelkarim",
  "Hannes Delcroix",
  "Hannibal Mejbri",
  "Hans Vanaken",
  "Haris Tabakovic",
  "Harry Kane",
  "Harry Souttar",
  "Hassan Al-Haydos",
  "Hassan Kadesh",
  "Hassan Tambakti",
  "Hazem Mastouri",
  "Helio Varela",
  "Henrik Falchener",
  "Hicham Boudaoui",
  "Hiroki Ito",
  "Hjalmar Ekdal",
  "Hossam Abdelmaguid",
  "Hossein Kanaani",
  "Houssem Aouar",
  "Hugo Sochurek",
  "Husam Abu Dahab",
  "Hussein Ali",
  "Hwang Hee-Chan",
  "Hwang In-Beom",
  "Ibrahim Adel",
  "Ibrahim Bayesh",
  "Ibrahim Maza",
  "Ibrahim Mbaye",
  "Ibrahim Saadeh",
  "Ibrahim Sabra",
  "Ibrahim Sangaré",
  "Ibrahima Konaté",
  "Idrissa Gana Gueye",
  "Igor Matanovic",
  "Igor Sergeev",
  "Igor Thiago",
  "Iliman Ndiaye",
  "Ime Okon",
  "Iñaki Williams",
  "Iqraam Rayners",
  "Irfan Can Kahveci",
  "Isak Hien",
  "Isidro Pitta",
  "Ismael Díaz",
  "Ismaël Gharbi",
  "Ismaël Koné",
  "Ismael Saibari",
  "Ismail Jakobs",
  "Ismail Yüksek",
  "Ismaïla Sarr",
  "Israel Reyes",
  "Issa Diop",
  "Issa Laye",
  "Ivan Basic",
  "Ivan Perisic",
  "Ivan Sunjic",
  "Ivan Toney",
  "Jack Hendry",
  "Jackson Irvine",
  "Jackson Porozo",
  "Jacob Italiano",
  "Jacob Shaffelburg",
  "Jakhongir Urozov",
  "Jaloliddin Masharipov",
  "Jamal Musiala",
  "James Rodríguez",
  "Jamie Leweling",
  "Jaminton Campaz",
  "Jamiro Monteiro",
  "Jamshid Iskanderov",
  "Jan Kuchta",
  "Jan Paul van Hecke",
  "Jaouen Hadjam",
  "Jarell Quansah",
  "Jaroslav Zeleny",
  "Jason Geria",
  "Jassim Gaber",
  "Jayden Adams",
  "Jean Michaël Seri",
  "Jean-Kévin Duverne",
  "Jean-Philippe Mateta",
  "Jean-Ricner Bellegarde",
  "Jearl Margaritha",
  "Jefferson Lerma",
  "Jehad Thakri",
  "Jens Castrop",
  "Jens Petter Hauge",
  "Jeremy Antonisse",
  "Jeremy Arévalo",
  "Jérémy Doku",
  "Jerome Opoku",
  "Jesper Karlström",
  "Jesse Randall",
  "Jesús Gallardo",
  "Jiovany Ramos",
  "Jo Yu-Min",
  "João Cancelo",
  "João Félix",
  "João Neves",
  "Joao Paulo",
  "Joaquín Piquerez",
  "Joaquin Seys",
  "Joe Bell",
  "Joe Scally",
  "Joel Ordóñez",
  "Joel Waterman",
  "Johan Manzambi",
  "Johan Vásquez",
  "John McGinn",
  "John Souttar",
  "John Stones",
  "John Yeboah",
  "Jonas Adjetey",
  "Jonathan David",
  "Jonathan Osorio",
  "Jonathan Tah",
  "Jordan Ayew",
  "Jordan Bos",
  "Jordan Henderson",
  "Jordy Alcívar",
  "Jordy Caicedo",
  "Jorge Carrascal",
  "Jorge Gutiérrez",
  "Jorge Sánchez",
  "Jørgen Strand Larsen",
  "Joris Kayembe",
  "Jorrel Hato",
  "Jose Canale",
  "José Córdoba",
  "José Fajardo",
  "José Luis Rodríguez",
  "Jose Manuel López",
  "José María Giménez",
  "Joshua Brenet",
  "Joshua Kimmich",
  "Josip Stanisic",
  "Josip Sutalo",
  "Josko Gvardiol",
  "Josué Casimir",
  "Jovane Cabral",
  "Jovo Lukic",
  "Juan Caceres",
  "Juan Camilo Hernández",
  "Juan Camilo Portilla",
  "Juan Fernando Quintero",
  "Juan Manuel Sanabria",
  "Jude Bellingham",
  "Jules Koundé",
  "Julián Álvarez",
  "Julián Quiñones",
  "Julian Ryerson",
  "Julio Enciso",
  "Juninho Bacuna",
  "Júnior Alonso",
  "Junnosuke Suzuki",
  "Junya Ito",
  "Jürgen Locadia",
  "Juriën Gaari",
  "Jurriën Timber",
  "Justin Kluivert",
  "Kaan Ayhan",
  "Kai Havertz",
  "Kai Trewin",
  "Kaishu Sano",
  "Kalidou Koulibaly",
  "Kamal Deen Sulemana",
  "Kamogelo Sebelebele",
  "Karem Akturkoglu",
  "Karim Boudiaf",
  "Karim Hafez",
  "Keeto Thermoncy",
  "Keisuke Goto",
  "Keito Nakamura",
  "Kelvin Pires",
  "Ken Sema",
  "Kenan Yildiz",
  "Kendry Páez",
  "Kenji Gorré",
  "Kenny McLean",
  "Kento Shiogai",
  "Kerim Alajbegovic",
  "Kevin Castaño",
  "Kevin Danso",
  "Kevin De Bruyne",
  "Kevin Felida",
  "Kevin Pina",
  "Kevin Rodríguez",
  "Kevin Yakob",
  "Khalid Al Ghannam",
  "Khalil Ayari",
  "Khojiakbar Alijonov",
  "Khuliso Mudau",
  "Khulumani Ndamane",
  "Kieran Tierney",
  "Kim Jin-Kyu",
  "Kim Min-Jae",
  "Kim Moon-Hwan",
  "Kim Tae-Hyun",
  "Knosinathi Sibisi",
  "Ko Itakura",
  "Kobbie Mainoo",
  "Kojo Oppong Peprah",
  "Koki Ogawa",
  "Koni De Winter",
  "Konrad Laimer",
  "Kosta Barbarouses",
  "Krépin Diatta",
  "Kristian Thorstvedt",
  "Kristijan Jakic",
  "Kristoffer Ajer",
  "Kwasi Sibo",
  "Kylian Mbappé",
  "Lachlan Bayliss",
  "Ladislav Krejcí",
  "Lamine Camara",
  "Lamine Yamal",
  "Laros Duarte",
  "Lautaro Martínez",
  "Lawrence Shankland",
  "Leandro Bacuna",
  "Leandro Paredes",
  "Leandro Trossard",
  "Lee Dong-Gyeong",
  "Lee Han-Beom",
  "Lee Jae-Sung",
  "Lee Kang-In",
  "Lee Ki-Hyeok",
  "Lee Tae-Seok",
  "Lennart Karl",
  "Lenny Joseph",
  "Leo Østigard",
  "Léo Pereira",
  "Leon Goretzka",
  "Leonardo Balerdi",
  "Leroy Sané",
  "Leverton Pierre",
  "Lewis Ferguson",
  "Liam Millar",
  "Liberato Cacace",
  "Lionel Messi",
  "Lisandro Martínez",
  "Livano Comenencia",
  "Logan Costa",
  "Luc de Fougerolles",
  "Luca Jaquez",
  "Lucas Bergvall",
  "Lucas Digne",
  "Lucas Hernández",
  "Lucas Herrington",
  "Lucas Mendes",
  "Lucas Paquetá",
  "Luis Chávez",
  "Luis Díaz",
  "Luis Romo",
  "Luis Suárez",
  "Luiz Henrique",
  "Luka Modric",
  "Luka Sucic",
  "Luka Vuskovic",
  "Lukás Cerv",
  "Lukás Provod",
  "Lyle Foster",
  "Lyndon Dykes",
  "Maghnes Akliouche",
  "Mahmoud Al-Mardi",
  "Mahmoud Saber",
  "Mahmoud Trezeguet",
  "Malick Thiaw",
  "Malik Tillman",
  "Malo Gusto",
  "Mamadou Sarr",
  "Manaf Younis",
  "Manu Koné",
  "Manuel Akanji",
  "Manuel Ugarte",
  "Marc Cucurella",
  "Marc Guéhi",
  "Marc Pubill",
  "Marcel Sabitzer",
  "Marcelo Flores",
  "Marco Friedl",
  "Marco Pasalic",
  "Marcos Llorente",
  "Marcus Pedersen",
  "Marcus Rashford",
  "Marcus Thuram",
  "Marin Pongracic",
  "Mario Pasalic",
  "Mark McKenzie",
  "Marko Arnautovic",
  "Marko Farji",
  "Marko Stamenic",
  "Marquinhos",
  "Marten de Roon",
  "Martin Baturina",
  "Martin Erlic",
  "Martin Expérience",
  "Martin Ødegaard",
  "Martín Zubimendi",
  "Marvin Senaya",
  "Marwan Ateya",
  "Mateo Chávez",
  "Mateo Kovacic",
  "Matheus Cunha",
  "Matheus Nunes",
  "Mathew Leckie",
  "Mathías Olivera",
  "Mathieu Choinière",
  "Matias Fernandez-Pardo",
  "Matías Galarza",
  "Matías Viña",
  "Mats Wieffer",
  "Matt Garbett",
  "Mattias Svanberg",
  "Mauricio Magalhaes",
  "Max Arfsten",
  "Maxence Lacroix",
  "Maxim De Cuyper",
  "Maximilian Beier",
  "Maximiliano Araújo",
  "Mbekezeli Mbokazi",
  "Mehdi Ghaedi",
  "Mehdi Torabi",
  "Memphis Depay",
  "Merchas Doski",
  "Merih Demiral",
  "Mert Müldür",
  "Meschak Elia",
  "Michael Boxall",
  "Michael Gregoritsch",
  "Michael Olise",
  "Michael Svoboda",
  "Michal Sadílek",
  "Michel Aebischer",
  "Micky van de Ven",
  "Miguel Almirón",
  "Mikel Merino",
  "Mikel Oyarzabal",
  "Milad Mohammadi",
  "Miles Robinson",
  "Milos Degenek",
  "Miro Muheim",
  "Mohamed Abdelmonemn",
  "Mohamed Amine Amoura",
  "Mohamed Amine Ben Hamida",
  "Mohamed Amine Tougai",
  "Mohamed Hany",
  "Mohamed Kanno",
  "Mohamed Salah",
  "Mohamed Toure",
  "Mohammad Abu Hasheesh",
  "Mohammad Abu Zrayq",
  "Mohammad Abualnadi",
  "Mohammad Al-Dawoud",
  "Mohammad Ghorbani",
  "Mohammad Mohebi",
  "Mohammed Abu Alshamat",
  "Mohammed Mannai",
  "Mohammed Muntari",
  "Mohammed Waad",
  "Mohanad Ali",
  "Mohanad Lasheen",
  "Mohannad Abu Taha",
  "Moïse Bombito",
  "Moisés Caicedo",
  "Mojmír Chytil",
  "Montassar Talbi",
  "Morgan Rogers",
  "Mortadha Ben Ouanes",
  "Morten Thorsby",
  "Mostafa Ziko",
  "Moteb Al Harbi",
  "Mousa Tamari",
  "Moussa Niakhaté",
  "Moutaz Neffati",
  "Mubarak Shannan",
  "Murillo",
  "Musab Al Juwayr",
  "Mustafa Saadoon",
  "N'Golo Kanté",
  "Nabil Bentaleb",
  "Nabil Emad",
  "Nadiem Amiri",
  "Nadir Benbouali",
  "Nahuel Molina",
  "Nando Pijnaker",
  "Nasser Al Dawsari",
  "Nathan Aké",
  "Nathan Ngoy",
  "Nathan Patterson",
  "Nathan Saliba",
  "Nathanaël Mbuku",
  "Nathaniel Brown",
  "Nawaf Boushal",
  "Nayef Aguerd",
  "Neil El Aynaoui",
  "Nélson Semedo",
  "Nestory Irankunda",
  "Neymar",
  "Ngal'ayel Mukau",
  "Niall Mason",
  "Nick Woltemade",
  "Nico Elvedi",
  "Nico O'Reilly",
  "Nico Paz",
  "Nico Schlotterbeck",
  "Nico Williams",
  "Nicolás De La Cruz",
  "Nicolás González",
  "Nicolas Jackson",
  "Nicolás Otamendi",
  "Nicolas Pépé",
  "Nicolas Raskin",
  "Nicolas Seiwald",
  "Nicolás Tagliafico",
  "Nidal Celik",
  "Nihad Mujakic",
  "Niko Sigur",
  "Nikola Katic",
  "Nikola Moro",
  "Nikola Vlasic",
  "Nilson Angulo",
  "Nishan Velupillay",
  "Nizar Al-Rashdan",
  "Noa Lang",
  "Noah Okafor",
  "Noah Sadiki",
  "Noni Madueke",
  "Noor Al-Rawabdeh",
  "Noussair Mazraoui",
  "Nuno da Costa",
  "Nuno Mendes",
  "Obed Vargas",
  "Odeh Fakhoury",
  "Odiljon Xamrobejov",
  "Odilon Kossounou",
  "Oguz Aydin",
  "Oh Hyun-Kyu",
  "Ollie Watkins",
  "Olwethu Makhanya",
  "Omar Alderete",
  "Omar Marmoush",
  "Omar Rekik",
  "Orbelín Pineda",
  "Orkun Kökçü",
  "Oscar Bobb",
  "Oston Uronov",
  "Oswin Appollis",
  "Otabek Shukurov",
  "Oumar Diakité",
  "Ousmane Diomande",
  "Ozan Kabak",
  "Paik Seung-Ho",
  "Pape Gueye",
  "Pape Matar Sarr",
  "Parfait Guiagon",
  "Park Jin-Seop",
  "Pascal Gross",
  "Pathé Ciss",
  "Patrick Berg",
  "Patrick Wimmer",
  "Patrik Schick",
  "Pau Cubarsí",
  "Paul Okon",
  "Paul Wanner",
  "Pavel Sulc",
  "Pedri",
  "Pedro Miguel",
  "Pedro Neto",
  "Pedro Porro",
  "Pedro Vite",
  "Pervis Estupiñán",
  "Petar Musa",
  "Petar Sucic",
  "Philipp Lienhart",
  "Philipp Mwene",
  "Pico",
  "Piero Hincapié",
  "Prince Kwabena Adu",
  "Promise David",
  "Quinten Timber",
  "Raed Chikhaoui",
  "Rafael Leão",
  "Rafik Belghali",
  "Rajaei Ayed",
  "Rami Rabia",
  "Ramin Rezaeian",
  "Ramiz Zerrouki",
  "Ramón Sosa",
  "Ramy Bensebaini",
  "Rani Khedira",
  "Raphinha",
  "Raúl Jiménez",
  "Rayan",
  "Rayan Ait Nouri",
  "Rayan Cherki",
  "Rayan Elloumi",
  "Rebin Sulaka",
  "Redouane Halhal",
  "Reece James",
  "Relebohile Mokofoeng",
  "Remo Freuler",
  "Renato Veiga",
  "Ricardo Adé",
  "Ricardo Pepi",
  "Ricardo Rodríguez",
  "Richard Ríos",
  "Richie Laryea",
  "Riechedly Bazoer",
  "Ritsu Doan",
  "Riyad Mahrez",
  "Roberto Alvarado",
  "Robin Hranác",
  "Roderick Miller",
  "Rodri",
  "Rodrigo Aguirre",
  "Rodrigo Bentancur",
  "Rodrigo De Paul",
  "Rodrigo Zalazar",
  "Roger Ibañez",
  "Romano Schmid",
  "Romelu Lukaku",
  "Ronald Araújo",
  "Roshon van Eijma",
  "Ross Stewart",
  "Rouzbeh Cheshmi",
  "Rúben Dias",
  "Rúben Neves",
  "Ruben Providence",
  "Rubén Vargas",
  "Rustam Ashurmatov",
  "Ryan Christie",
  "Ryan Gravenberch",
  "Ryan Mendes",
  "Ryan Thomas",
  "Sadio Mané",
  "Saed Al-Rosan",
  "Saeid Ezatolahi",
  "Saleem Obaid",
  "Saleh Al Shehri",
  "Saleh Hardani",
  "Salem Al Dawsari",
  "Salih Özcan",
  "Saman Ghoddos",
  "Samed Bazdar",
  "Samet Akaydin",
  "Samir Chergui",
  "Samir El Mourabet",
  "Samú Costa",
  "Samuel Moutoussamy",
  "Samukele Kabini",
  "Sander Berge",
  "Santiago Bueno",
  "Santiago Gimenez",
  "Santos",
  "Sarpreet Singh",
  "Sasa Kalajdzic",
  "Saud Abdulhamid",
  "Scott McKenna",
  "Scott McTominay",
  "Sead Kolasinac",
  "Sebastian Berhalter",
  "Sebastián Cáceres",
  "Sebastian Tounekti",
  "Seko Fofana",
  "Seol Young-Woo",
  "Sergiño Dest",
  "Shahriyar Moghanloo",
  "Sherel Floranus",
  "Sherzod Esanov",
  "Sherzod Nasrullaev",
  "Shogo Taniguchi",
  "Shoka Khalilzadeh",
  "Shurandy Sambo",
  "Sidny Lopes Cabral",
  "Silvan Widmer",
  "Simon Adingra",
  "Simon Banza",
  "Sofyan Amrabat",
  "Son Heung-Min",
  "Sondre Langås",
  "Sontje Hansen",
  "Soufiane Rahimi",
  "Sphephelo Sithole",
  "Stefan Posch",
  "Stepán Chaloupek",
  "Stephen Eustáquio",
  "Steve Kapuadi",
  "Steven Moreira",
  "Stjepan Radeljic",
  "Stopira",
  "Sultan Al Brake",
  "Sultan Mandash",
  "Taha Ali",
  "Tahith Chong",
  "Tahsin Mohammed",
  "Tajon Buchanan",
  "Takefusa Kubo",
  "Takehiro Tomiyasu",
  "Tani Oluwaseyi",
  "Tarek Alaa",
  "Taremi",
  "Tarik Muharemovic",
  "Teboho Mokoena",
  "Telmo Arcanjo",
  "Tete Yengi",
  "Teun Koopmeiners",
  "Thabang Matuludi",
  "Thalente Mbatha",
  "Thapelo Maseko",
  "Thelo Aasgaard",
  "Themba Zwane",
  "Théo Bongonda",
  "Theo Hernández",
  "Thiago Almada",
  "Thomas Meunier",
  "Thomas Partey",
  "Tijjani Reijnders",
  "Tim Payne",
  "Tim Ream",
  "Tim Weah",
  "Timothy Castagne",
  "Tino Livramento",
  "Tomás Araújo",
  "Tomás Chory",
  "Tomás Holes",
  "Tomás Rodríguez",
  "Tomás Soucek",
  "Tommy Smith",
  "Toni Fruk",
  "Torbjørn Heggem",
  "Tshepang Moremi",
  "Tsuyoshi Watanabe",
  "Tyler Adams",
  "Tyler Bindon",
  "Tyrese Noslin",
  "Um Ji-Sung",
  "Umar Eshmurodov",
  "Valentín Barco",
  "Victor Lindelöf",
  "Víctor Muñoz",
  "Viktor Gyökeres",
  "Vinícius Júnior",
  "Virgil van Dijk",
  "Vitinha",
  "Vladimír Coufal",
  "Vladimír Darida",
  "Wagner Pina",
  "Waldemar Anton",
  "Warren Zaïre-Emery",
  "Wataru Endo",
  "Wesley",
  "Weston McKennie",
  "Wilfried Singo",
  "Wilguens Paugain",
  "William Saliba",
  "Willian Pacho",
  "Willy Semedo",
  "Wilson Isidor",
  "Woodensky Pierre",
  "Wout Weghorst",
  "Xaver Schlager",
  "Yaimar Medina",
  "Yan Diomande",
  "Yan Valery",
  "Yang Hyun-Jun",
  "Yannick Semedo",
  "Yasin Ayari",
  "Yasser Ibrahim",
  "Yassin Fortuné",
  "Yassine Titraoui",
  "Yazan Al-Arab",
  "Yéremy Pino",
  "Yoane Wissa",
  "Yoel Bárcenas",
  "Youri Tielemans",
  "Youssef Amyn",
  "Youssef Belammari",
  "Yuito Suzuki",
  "Yukinari Sugawara",
  "Yunus Akgün",
  "Yusuf Abdurisag",
  "Yūto Nagatomo",
  "Zaid Ismail",
  "Zaid Tahseen",
  "Zakaria El Ouahdi",
  "Zeki Amdouni",
  "Zeki Çelik",
  "Zeno Debast",
  "Zidane Iqbal",
  "Zinedine Belaid",
  "Ziyad Al Johani"
];

/** @deprecated Compatibilidad: todos los convocados. */
export const AWARD_NOMINEES = [...AWARD_OUTFIELD_PLAYERS, ...AWARD_GOALKEEPERS].sort((a, b) =>
  a.localeCompare(b, "es", { sensitivity: "base" }),
);

/**
 * @param {"gk" | "outfield"} role
 * @returns {string[]}
 */
export function getAwardCandidates(role) {
  return role === "gk" ? AWARD_GOALKEEPERS : AWARD_OUTFIELD_PLAYERS;
}

/**
 * @param {"gk" | "outfield"} role
 * @returns {SquadEntry[]}
 */
export function getSquadEntriesByRole(role) {
  return SQUAD_ENTRIES.filter((e) => e.role === role);
}
