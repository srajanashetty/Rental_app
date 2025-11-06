import express from "express";
import { sendEmail } from "./utils/emailSender.js";
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

dotenv.config();
const app = express();

// Logging requests in development
if (process.env.NODE_ENV !== "production") app.use(morgan("dev"));

// Static folder for frontend build files
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.resolve(__dirname, "../client/dist")));

// Core security and parsing middleware
app.use(express.json());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(xss());
app.use(mongoSanitize());
app.set("trust proxy", 1);
app.use(cookieParser());

// ✅ CORS setup: MUST BE BEFORE ROUTES

const allowedOrigins = [
  "http://localhost:5173",
  "https://rental-appp-management.onrender.com"
];

app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true);   // allow tools/postman
    return cb(null, allowedOrigins.includes(origin));
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

app.options("*", cors());

// Test route
app.get("/test-backend", (req, res) => {
  res.status(200).json({ message: "Backend is working!" });
});

app.get("/api/test-email", async (req, res) => {
  try {
    await sendEmail(
      "srajanashetty2611@gmail.com",
      "Tenantix Email Test ✅",
      "<h2>Hello! SendGrid test email from Tenantix server.</h2>"
    );

    res.send("✅ Email sent successfully!");
  } catch (err) {
    console.error("SendGrid error:", err);
    res.status(500).send("❌ Email failed: " + err.message);
  }
});



// ======================= ROUTES ============================

// Public routes
app.use("/api/auth", authRoutes);
app.use("/api/sendEmail", emailSenderRoutes);
app.use("/api/contract", contractRoutes);
app.use("/api/chat", chatRoutes);

// Protected Owner routes
app.use("/api/owner/real-estate", authorizeOwnerUser, ownerPropertyRoutes);
app.use("/api/owner", authorizeOwnerUser, ownerUserRoutes);
app.use("/api/rentDetail", authorizeOwnerUser, ownerRentDetailRoutes);

// Protected Tenant routes
app.use("/api/tenant/real-estate", authorizeTenantUser, tenantPropertyRoutes);
app.use("/api/tenant", authorizeTenantUser, tenantUserRoutes);
app.use("/api/rentDetailTenant", authorizeTenantUser, tenantRentDetailRoutes);

// Serve frontend (React) build in production
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../client/dist", "index.html"));
});

// Error handling
app.use(errorHandlerMiddleware);
app.use(routeNotFoundMiddleware);

// ======================= START SERVER ============================
const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // ======================= SOCKET.IO ============================
    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
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
  } catch (error) {
    console.log(" Database connection error:", error);
  }
};

start();