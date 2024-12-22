// Load environment variables from .env file
require("dotenv/config");
const AWS = require("aws-sdk");
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const stream = require("stream");
const mongoose = require("mongoose")
const voicedataModel = require("./voiceModel")


const app = express();

const port = process.env.PORT;

app.use(cors());

app.use(express.json());



mongoose.connect(process.env.MONGODB_URL_LOCAL)
.then(()=>{console.log("mongodb connected successfully")})
.catch((err)=>{console.log(err.message)})

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});
 
  

app.get("/", async(req, res)=>{
    res.sendFile(path.join(__dirname, "voice.html"))
})

app.get("/SSML", async(req, res)=>{
    res.sendFile(path.join(__dirname, "voiceSSML.html"))
})

// Set AWS Region and Credentials from environment variables
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const polly = new AWS.Polly();

const synthesizeSpeech = async (params) => {
  try {
    return await polly.synthesizeSpeech(params).promise();
  } catch (err) {
    throw new Error(err.message);
  }
};

const audioDir = path.join((__dirname, "audios"));

if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir);
} 
 
app.post("/tts", async (req, res) => {
    try {
      const { text, voiceId, engine } = req.body;
  console.log(req.body)
      // Validate required fields
      if (!text || !voiceId || !engine) {
        return res
          .status(400)
          .json({ status: false, message: "Missing required fields" });
      }
    //   const formattedText = isSSML ? text : `<speak>${text}</speak>`;  // Wrap the text in SSML tags if not already SSML
      // AWS Polly parameters for synthesizing speech
      const params = {
        OutputFormat: "mp3",
        Text: text,
        VoiceId: voiceId,
        Engine: engine,
      };
  
      // Generate speech with AWS Polly
      const pollyData = await synthesizeSpeech(params);
  
      // If Polly returns an AudioStream, upload it to Cloudinary
      if (pollyData.AudioStream) {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(pollyData.AudioStream);
  
        // Upload audio stream directly to Cloudinary
        const cloudinaryUpload = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: "video" },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          bufferStream.pipe(uploadStream);
        });
  
        let publicId = cloudinaryUpload.public_id

        let url = cloudinaryUpload.secure_url


        if(publicId !== "string"){
            publicId = publicId.toString()
        }
        if(url !== "string"){
            url = url.toString()
        }

        // Store the Cloudinary public_id and URL in the database with associated voice data
        const voiceData = await voicedataModel.create({
          text: text,
          voiceId: voiceId,
          engine: engine,
          audioData: {
            public_id: publicId,
            url:url,
          },
        });
        console.log(voiceData)
        return res.status(200).json({
          status: true,
          message: "Audio created and stored successfully",
          data: voiceData,
        });
      } else {
        return res.status(400).json({
          status: false,
          message: "Something went wrong while creating text-to-speech audio",
        });
      }
    } catch (err) {
      res.status(500).json({ status: false, message: err.message });
    }
  });



// for ssml  

app.post("/ttsSSML", async (req, res) => {
    try {
      const { text, voiceId, engine, isSSML } = req.body;
      console.log(req.body);
  
      // Validate required fields
      if (!text || !voiceId || !engine) {
        return res.status(400).json({ status: false, message: "Missing required fields" });
      }
  
      let formattedText = text;
  
      // If the text is not already SSML and isSSML flag is set, wrap in SSML tags
      if (isSSML) {
    formattedText = text 
}
      // AWS Polly parameters for synthesizing speech
      const params = {
        OutputFormat: "mp3",
        Text: formattedText,
        VoiceId: voiceId,
        Engine: engine,
      };
  
      // Generate speech with AWS Polly
      const pollyData = await synthesizeSpeech(params);
  
      // If Polly returns an AudioStream, upload it to Cloudinary
      if (pollyData.AudioStream) {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(pollyData.AudioStream);
  
        // Upload audio stream directly to Cloudinary
        const cloudinaryUpload = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: "video" },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          bufferStream.pipe(uploadStream);
        });
  
        let publicId = cloudinaryUpload.public_id;
        let url = cloudinaryUpload.secure_url;
  
        if (publicId !== "string") {
          publicId = publicId.toString();
        }
        if (url !== "string") {
          url = url.toString();
        }
  
        // Store the Cloudinary public_id and URL in the database with associated voice data
        const voiceData = await voicedataModel.create({
          text: text,
          voiceId: voiceId,
          engine: engine,
          audioData: {
            public_id: publicId,
            url: url,
          },
        });
  
        return res.status(200).json({
          status: true,
          message: "Audio created and stored successfully",
          data: voiceData,
        });
      } else {
        return res.status(400).json({
          status: false,
          message: "Something went wrong while creating text-to-speech audio",
        });
      }
    } catch (err) {
      res.status(500).json({ status: false, message: err.message });
    }
  });
  




/* 

// Function to get all available languages from Polly
const getAllLanguages = async () => {
  try {
    const data = await polly.describeVoices().promise();
    // Extract all unique languages
    const languages = [
      ...new Set(data.Voices.map((voice) => voice.LanguageCode)),
    ];
    return languages;
  } catch (err) {
    console.error("Error fetching languages: ", err);
    throw new Error("Could not fetch languages from AWS Polly");
  }
};



// Route 1: Get all available languages
app.get("/languages", async (req, res) => {
    try {
      const languages = await getAllLanguages();
      res.json({ languages });
    } catch (err) {
      res.status(500).send(err.message);
    }
  });

 */


  const getAllLanguages = async () => {
    try {
      const data = await polly.describeVoices().promise();
  
      // Group voices by engine type
      const languagesByEngine = data.Voices.reduce((acc, voice) => {
        voice.SupportedEngines.forEach((engine) => {
          if (!acc[engine]) {
            acc[engine] = new Set(); // Use Set to avoid duplicates
          }
          acc[engine].add(voice.LanguageCode); // Add language to corresponding engine type
        });
        return acc;
      }, {});
  
      // Convert sets to arrays for easy response
      Object.keys(languagesByEngine).forEach(engine => {
        languagesByEngine[engine] = [...languagesByEngine[engine]];
      });
  
      return languagesByEngine; // { STANDARD: [...languages], NEURAL: [...languages] }
    } catch (err) {
      console.error("Error fetching languages: ", err);
      throw new Error("Could not fetch languages from AWS Polly");
    }
  };
  
  // Route 1: Get all available languages grouped by engine
  app.get("/languages", async (req, res) => {
    try {
      const languages = await getAllLanguages();
      res.json({ languages });
    } catch (err) {
      res.status(500).send(err.message);
    }
  });
  






// Function to get voices by language code and engine type
const getVoicesByLanguage = async (languageCode, engineType = "standard") => {
    const params = {
      LanguageCode: languageCode,
    };
    
    try {
      const data = await polly.describeVoices(params).promise();
      console.log('Returned Voices:', data.Voices);  
  
      const filteredVoices = data.Voices.filter((voice) =>
        voice.SupportedEngines.some(
          (engine) => engine.toLowerCase() === engineType.toLowerCase()
        )
      );
      console.log('Filtered Voices:', filteredVoices);  
  
      return filteredVoices;
    } catch (err) {
      console.error("Error fetching voices by language: ", err);
      throw new Error("Could not fetch voices for the specified language");
    }
  };

  
  // Route 2: Get voices by language code and engine type
  app.get("/voices", async (req, res) => {
    const { languageCode, engineType } = req.query; // neural or standard
    if (!languageCode) {
      return res.status(400).send("Language code is required");
    }
  
    try {
      const voices = await getVoicesByLanguage(
        languageCode,
        engineType || "standard"
      );
      res.json({ voices });
    } catch (err) {
      res.status(500).send(err.message);
    }
  });
  

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
