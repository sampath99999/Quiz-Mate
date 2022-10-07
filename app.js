const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const indexRouter = require("./routes/index");
const userModel = require("./model/user");
const roomModel = require("./model/rooms");
const answerModel = require("./model/question");
const mongoose = require("mongoose");
const question = require("./model/question");
const dotenv = require("dotenv");

const app = express();
const server = http.createServer(app);
const io = socketio(server);
dotenv.config()

const PORT = process.env.PORT || 3000;

// Listen on port 3000
server.listen(PORT, (err) => {
    if (err) throw err;
    console.log("App Started!");
});

main().catch((err) => console.log(err));

async function main() {
    await mongoose.connect(process.env.DB);
}

// Run when client connects
io.on("connection", (socket) => {
    socket.on("createRoom", async (details) => {
        try {
            const room = await roomModel.findOne({
                roomCode: details.roomCode,
            });
            if (!room) {
                const newRoom = new roomModel({
                    roomCode: details.roomCode,
                    playing: false,
                });
                newRoom.save();

                const user = new userModel({
                    username: details.username,
                    socketid: socket.id,
                    roomid: newRoom._id,
                    admin: true,
                    score: 0,
                });
                user.save();
                socket.join(newRoom.roomCode);
            } else {
                socket.emit("error", "Room already exists!");
            }
        } catch (err) {
            console.log(err);
            socket.emit("error", "Please try again!");
        }
    });

    socket.on("disconnect", async () => {
        try {
            //first we are getting user information
            const user = await userModel.findOne({ socketid: socket.id });
            const room = await roomModel.findOne({ _id: user.roomid });
            //checking if user is admin
            if (user.admin == true) {
                //if yes we are deleting room and users in room
                await roomModel.deleteOne({ _id: user.roomid });
                await userModel.deleteMany({ roomid: user.roomid });
                io.to(room.roomCode).emit("error", "Room Closed admin left!");
            } else {
                // if no deleting the user from room
                await userModel.deleteOne({ _id: user._id });

                // and checking if room already started
                if (room.playing == true) {
                    const users = await userModel.find({ roomid: user.roomid });

                    // if started check if users in room is > 2
                    if (users.length < 2) {
                        // if yes deleting the room and users in room
                        await roomModel.deleteOne({ _id: user.roomid });
                        await userModel.deleteMany({ roomid: user.roomid });
                        io.to(room.roomCode).emit(
                            "error",
                            "Not enought people to continue!"
                        );
                    } else {
                        // if not sending user disconnected message
                        io.to(room.roomCode).emit(
                            "userDisconnected",
                            user.username
                        );
                    }
                } else {
                    io.to(room.roomCode).emit(
                        "userDisconnected",
                        user.username
                    );
                }
            }
        } catch (error) {}
    });

    socket.on("joinRoom", async ({ roomCode, username }) => {
        try {
            const room = await roomModel.findOne({
                roomCode: roomCode,
            });
            if (room) {
                if (room.playing == true) {
                    socket.emit("error", "Room already started!");
                } else {
                    const user = new userModel({
                        username: username,
                        socketid: socket.id,
                        roomid: room._id,
                        admin: false,
                        score: 0,
                    });
                    user.save();
                    socket.join(room.roomCode);
                }
            } else {
                socket.emit("error", "Room Doesn't exists!");
            }
        } catch (err) {
            console.log(err);
            socket.emit("error", "Please try again!");
        }
    });

    socket.on("start", async () => {
        var user = await userModel.findOne({ socketid: socket.id });
        var room = await roomModel.findOne({ _id: user.roomid });
        var users = await userModel.find({ roomid: room._id });
        var question = {};
        if (users.length > 1) {
            question = await getQuestion();
            await roomModel.updateOne(
                { _id: room._id },
                { questions: room.questions + 1, playing: true }
            );
            io.to(room.roomCode).emit("question", question);
        } else {
            socket.emit("error2", "Not Enough Platers to start!");
        }
    });

    socket.on("question", async () => {
        var user = await userModel.findOne({ socketid: socket.id });
        var room = await roomModel.findOne({ _id: user.roomid });
        var users = await userModel.find({ roomid: room._id }, "username score");
        var question = {};

        if (room.questions == 10) {
            io.to(room.roomCode).emit("completed", users);
        } else {
            question = await getQuestion();
            await roomModel.updateOne(
                { _id: room._id },
                { questions: room.questions + 1 }
            );
            io.to(room.roomCode).emit("question", question);
        }
    });

    socket.on("answer", async (answerDetails) => {
        const answer = answerDetails.answer;
        const answerId = answerDetails.answerId;
        const user = await userModel.findOne({ socketid: socket.id });
        const room = await roomModel.findOne({ _id: user.roomid });
        const users = await userModel.find({ roomid: room._id });
        const question = await answerModel.findOne({ _id: answerId });

        // checking the answer
        if (parseInt(answer) == parseInt(question.answer)) {
            // if true updating score of user
            await userModel.updateOne(
                { _id: user._id },
                { score: user.score + 10 }
            );
            socket.emit("score", user.score + 10);
        }

        await answerModel.updateOne(
            { _id: answerId },
            { answered: question.answered + 1 }
        );
        // checking if all users answered
        if (question.answered + 1 == users.length) {
            // if true deleting the answer
            await answerModel.deleteOne({ _id: answerId });
            // sending emit to generate next question
            socket.emit("nextQuestion");
        } else {
            // if not emeting to wait
            socket.emit("wait");
        }
    });
});

async function getQuestion() {
    const operations = ["x", "/", "+", "-"];
    var operation = operations[Math.floor(Math.random() * operations.length)];

    var number1 = 0;
    var number2 = 0;
    var answer = 0;
    var answerDoc = null;
    var answerId = null;
    switch (operation) {
        case "x":
            // Getting numbers
            number1 = (await Math.floor(Math.random() * 10)) + 1;
            number2 = (await Math.floor(Math.random() * 100)) + 1;

            // Gettting answer
            answer = number1 * number2;

            // saving answer in db and getting id
            answerDoc = await new answerModel({
                answer,
            });
            await answerDoc.save();
            answerId = answerDoc._id;

            return { question: `${number1} x ${number2}`, answerId };
        case "/":
            // Getting numbers
            number1 = Math.floor(Math.random() * 10) + 1;
            number2 = Math.floor(Math.random() * 10) + 1;

            var temp = number1 * number2;
            // Gettting answer
            answer = number1;

            // saving answer in db and getting id
            answerDoc = await new answerModel({
                answer,
            });
            await answerDoc.save();
            answerId = answerDoc._id;

            return { question: `${temp} / ${number2}`, answerId };

        case "+":
            // Getting numbers
            number1 = Math.floor(Math.random() * 100) + 1;
            number2 = Math.floor(Math.random() * 100) + 1;

            // Gettting answer
            answer = number1 + number2;

            // saving answer in db and getting id
            answerDoc = await new answerModel({
                answer,
            });
            await answerDoc.save();
            answerId = answerDoc._id;

            return { question: `${number1} + ${number2}`, answerId };
        case "-":
            // Getting numbers
            number1 = Math.floor(Math.random() * 100) + 1;
            number2 = Math.floor(Math.random() * 100) + 1;

            // Gettting answer
            answer = number1 - number2;

            // saving answer in db and getting id
            answerDoc = await new answerModel({
                answer,
            });
            await answerDoc.save();
            answerId = answerDoc._id;

            return { question: `${number1} - ${number2}`, answerId };
        default:
            break;
    }
}

const deleteAll = async () => {
    await userModel.deleteMany({});
    await answerModel.deleteMany({});
    await roomModel.deleteMany({});
};

deleteAll();

// sets
app.set("view engine", "ejs");
app.use(express.static("public"));

// Routers
app.use("/", indexRouter);
