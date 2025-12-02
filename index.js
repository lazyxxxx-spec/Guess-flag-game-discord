// index.js

const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder 
} = require('discord.js');
const fs = require('fs'); // Import the File System module

// --- 0. Configuration and Initialization ---
const PREFIX = '!'; 
const SCORES_FILE = './scores.json';
const GAME_DURATION_MS = 60000; // 60 seconds

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent 
    ] 
});

const BOT_TOKEN = 'YOuR BOT TOKEN'; 

// --- 1. The Flag Data (Now split by difficulty) ---
const FLAG_DATA = {
    // Easy: Well-known flags
    easy: {
        "United States": "🇺🇸", "Canada": "🇨🇦", "Mexico": "🇲🇽", 
        "Brazil": "🇧🇷", "United Kingdom": "🇬🇧", "France": "🇫🇷",
        "Germany": "🇩🇪", "Italy": "🇮🇹", "Spain": "🇪🇸",
        "Japan": "🇯🇵", "China": "🇨🇳", "India": "🇮🇳",
        "Australia": "🇦🇺", "South Africa": "🇿🇦",
    },
    // Medium: More common flags
    medium: {
        "Argentina": "🇦🇷", "Colombia": "🇨🇴", "Chile": "🇨🇱", 
        "Netherlands": "🇳🇱", "Sweden": "🇸🇪", "Norway": "🇳🇴",
        "Greece": "🇬🇷", "Poland": "🇵🇱", "Vietnam": "🇻🇳",
        "South Korea": "🇰🇷", "Egypt": "🇪🇬", "Nigeria": "🇳🇬",
        "Morocco": "🇲🇦", "New Zealand": "🇳🇿", "Turkey": "🇹🇷",
    },
    // Hard: Less common flags
    hard: {
        "Jamaica": "🇯🇲", "Cuba": "🇨🇺", "Panama": "🇵🇦", 
        "Venezuela": "🇻🇪", "Uruguay": "🇺🇾", "Portugal": "🇵🇹",
        "Belgium": "🇧🇪", "Switzerland": "🇨🇭", "Austria": "🇦🇹",
        "Finland": "🇫🇮", "Ireland": "🇮🇪", "Thailand": "🇹🇭",
        "Indonesia": "🇮🇩", "Philippines": "🇵🇭", "Algeria": "🇩🇿",
    }
};

// --- 2. Game State Variables & Scoring ---
let currentAnswer = null;
let gameActive = false;
let gameChannelId = null;
let gameTimer = null; // Variable to hold our 60-second timer
let currentDifficulty = 'easy'; // Default to easy

let scores = {}; // Global object to hold scores

// --- Functions for Score Management ---

// Loads scores from scores.json file
function loadScores() {
    if (fs.existsSync(SCORES_FILE)) {
        const data = fs.readFileSync(SCORES_FILE, 'utf8');
        scores = JSON.parse(data);
    }
}

// Saves scores to scores.json file
function saveScores() {
    fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 4));
}

// --- 3. Game Logic Functions ---

// Function to end the game (called by timer or successful guess)
const endGame = async (channel, message) => {
    gameActive = false;
    currentAnswer = null;
    gameChannelId = null;
    if (gameTimer) {
        clearTimeout(gameTimer);
        gameTimer = null;
    }
    await channel.send(message);
};

// Function to start the game (Reused by both handlers)
const startGame = async (channel, replyMethod, difficulty = 'easy') => {
    if (gameActive) {
        return replyMethod("A game is already in progress! Guess the current flag.");
    }
    
    // Validate difficulty input
    if (!FLAG_DATA[difficulty]) {
        return replyMethod(`Invalid difficulty: **${difficulty}**. Please use easy, medium, or hard.`);
    }

    currentDifficulty = difficulty;
    const flagSet = FLAG_DATA[difficulty];
    
    // Pick a random country
    const countryNames = Object.keys(flagSet);
    const countryName = countryNames[Math.floor(Math.random() * countryNames.length)];
    const flagEmoji = flagSet[countryName];
    
    // Save the state
    currentAnswer = countryName.toLowerCase();
    gameActive = true;
    gameChannelId = channel.id;

    // Set the 60-second timer
    gameTimer = setTimeout(async () => {
        const timeoutMessage = `⏰ **TIME'S UP!** Nobody guessed the flag. It was **${countryName}**!`;
        await endGame(channel, timeoutMessage);
    }, GAME_DURATION_MS);


    // Create the embed message
    const flagEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`GUESS THE FLAG! (Difficulty: ${difficulty.toUpperCase()})`)
        .setDescription(`What country does this flag belong to?\n\n**${flagEmoji}**`)
        .setFooter({ text: `Type your guess in chat! You have ${GAME_DURATION_MS / 1000} seconds.` });

    await replyMethod({ embeds: [flagEmbed] });
};

// --- Bot Ready Event ---
client.on('ready', () => {
    console.log(`Bot is online as ${client.user.tag}!`);
    loadScores(); // Load scores when the bot starts
    
    // Register the Slash Command (only needs to be done once)
    client.application.commands.create({
        name: 'start_flag',
        description: 'Starts a new Guess the Flag game.',
        options: [{
            name: 'difficulty',
            type: 3, // String
            description: 'Choose difficulty: easy, medium, or hard',
            required: false,
            choices: [
                { name: 'Easy', value: 'easy' },
                { name: 'Medium', value: 'medium' },
                { name: 'Hard', value: 'hard' },
            ],
        }],
    });
});

// --- 4. The Slash Command Handler (/start_flag) ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    
    if (interaction.commandName === 'start_flag') {
        const difficulty = interaction.options.getString('difficulty') || 'easy';
        // Start the game using the interaction.reply method
        await startGame(interaction.channel, (content) => interaction.reply(content), difficulty);
    }
});


// --- 5. Handling Prefix Commands (!flags, !skip, !score) AND Guesses ---
client.on('messageCreate', async message => {
    if (message.author.bot) {
        return;
    }
    
    // --- PART A: CHECK FOR PREFIX COMMANDS ---
    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        // 5a. Start Command (!flags [difficulty])
        if (command === 'flags' || command === 'start_flag') {
            const difficulty = args[0] ? args[0].toLowerCase() : 'easy';
            await startGame(message.channel, (content) => message.reply(content), difficulty);
            return;
        }

        // 5b. Skip Command (!skip)
        if (command === 'skip') {
            if (!gameActive) {
                return message.reply("There is no active game to skip.");
            }
            const skipMessage = `⏭️ **GAME SKIPPED!** The answer was **${currentAnswer.toUpperCase()}**.`;
            await endGame(message.channel, skipMessage);
            return;
        }

        // 5c. Score Command (!score)
        if (command === 'score' || command === 'leaderboard') {
            
            // Format and sort scores
            const sortedScores = Object.entries(scores)
                .map(([id, score]) => ({ id, score }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 10); // Show top 10
            
            let description = sortedScores.length > 0 
                ? sortedScores.map((data, index) => {
                    const user = client.users.cache.get(data.id);
                    const name = user ? user.username : `User ID: ${data.id}`;
                    return `${index + 1}. **${name}**: ${data.score} guesses`;
                }).join('\n')
                : 'No scores recorded yet!';

            const scoreEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🏆 Top Flag Guesses')
                .setDescription(description)
                .setFooter({ text: 'Use !flags to start a new game!' });
            
            await message.channel.send({ embeds: [scoreEmbed] });
            return;
        }
    }
    
    // --- PART B: CHECK FOR GUESSES ---
    // Ignore if no game is active OR if the message is not in the active channel
    if (!gameActive || message.channel.id !== gameChannelId) {
        return;
    }

    const userGuess = message.content.trim().toLowerCase();

    // Check if the guess is correct
    if (userGuess === currentAnswer) {
        
        // --- SCORING LOGIC ---
        const userId = message.author.id;
        scores[userId] = (scores[userId] || 0) + 1; // Increment score
        saveScores(); // Save updated scores
        
        const successMessage = `🎉 **CORRECT!** ${message.author} guessed **${currentAnswer.toUpperCase()}**! You now have **${scores[userId]}** correct guesses!`;
        
        await endGame(message.channel, successMessage);
    } 
    // Optional: Add a 'try again' message here
});


client.login(BOT_TOKEN);
