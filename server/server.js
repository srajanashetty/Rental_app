import express from "express";
import dotenv from "dotenv";
import "express-async-errors";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

// Security packages
import helmet from "helmet";
import xss from "xss-clean";
import mongoSanitize from "express-mongo-sanitize";

// Database and routes
import connectDB from "./database/connectDB.js";

import authRoutes from "./routes/authRoutes.js";
import ownerPropertyRoutes from "./routes/ownerPropertyRoutes.js";
import tenantPropertyRoutes from "./routes/tenantPropertyRoutes.js";
import ownerUserRoutes from "./routes/ownerUserRoutes.js";
import tenantUserRoutes from "./routes/tenantUserRoutes.js";
import emailSenderRoutes from "./routes/emailSenderRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";
import ownerRentDetailRoutes from "./routes/rentDetailOwnerRoutes.js";
import tenantRentDetailRoutes from "./routes/rentDetailTenantRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

import routeNotFoundMiddleware from "./middleware/route-not-found.js";
import errorHandlerMiddleware from "./middleware/error-handler.js";
import { authorizeOwnerUser, authorizeTenantUser } from "./middleware/userAuthorization.js";

import { Server } from "socket.io";

import path, { dirname } from "path";
import { fileURLToPath } from "url";

import Property from "./models/Property.js";

dotenv.config();

const app = express();

// Logging requests in development
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// Static folder for frontend build files
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.resolve(__dirname, "../client/dist")));

// Middleware
app.use(express.json());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(xss());
app.use(mongoSanitize());
app.set("trust proxy", 1);
app.use(cookieParser());

// ✅ Proper CORS setup
app.use(
  cors({
    origin:  ["https://tenantix-finalfrontend.onrender.com"], // correct frontend URL
    //credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

//app.options("*", cors({
 // origin: "https://tenantix-finalfrontend.onrender.com",
 // credentials: true,
//}));

app.use(cookieParser()); //to parse cookies

app.use(function (req, res, next) {
  res.header("Content-Type", "application/json;charset=UTF-8");
  res.header("Access-Control-Allow-Credentials", true);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});


// Routes
app.use("/api/auth", authRoutes);
app.use("/api/owner/real-estate", authorizeOwnerUser, ownerPropertyRoutes);
app.use("/api/tenant/real-estate", authorizeTenantUser, tenantPropertyRoutes);

app.use("/api/owner", authorizeOwnerUser, ownerUserRoutes);
app.use("/api/tenant", authorizeTenantUser, tenantUserRoutes);

app.use("/api/sendEmail", emailSenderRoutes); //send mail

app.use("/api/contract", contractRoutes);

app.use("/api/rentDetail", authorizeOwnerUser, ownerRentDetailRoutes);
app.use("/api/rentDetailTenant", authorizeTenantUser, tenantRentDetailRoutes);

app.use("/api/chat", chatRoutes);

// Serve frontend files in production
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../client/dist", "index.html"));
});

// Error handling
app.use(errorHandlerMiddleware);
app.use(routeNotFoundMiddleware);

const PORT = process.env.PORT || 5000;

// Start server and connect to DB
const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
  } catch (error) {
    console.log(error);
  }
};
start();

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: ["https://tenantix-finalfrontend.onrender.com"],
    credentials: true,
  },
});

global.onlineUsers = new Map();

io.on("connection", (socket) => {
  global.chatSocket = socket;

  socket.on("addUser", (userId) => {
    onlineUsers.set(userId, socket.id);
  });

  socket.on("sendMsg", (data) => {
    const sendUserSocketId = onlineUsers.get(data.to);
    if (sendUserSocketId) {
      socket.to(sendUserSocketId).emit("receiveMsg", data.message);
    }
  });
});
