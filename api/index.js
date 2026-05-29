const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const zlib = require("zlib")
const { v4: uuidv4 } = require("uuid")

const app = express()

app.use(cors())

app.use(express.json({
    limit: "50mb"
}))

// =========================
// CONFIG
// =========================

const JWT_SECRET =
    process.env.JWT_SECRET

const LUCKS_API_KEY =
    process.env.LUCKS_API_KEY

const DOMAIN_PRICE = 100

// =========================
// MONGO
// =========================

mongoose.connect(
    process.env.MONGO_URI
)

mongoose.connection.once(
    "open",
    () => {
        console.log(
            "Mongo connected"
        )
    }
)

// =========================
// MODELS
// =========================

const UserSchema =
new mongoose.Schema({

    username: {
        type: String,
        unique: true
    },

    password: String,

    lucks: {
        type: Number,
        default: 0
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

})



const DomainSchema =
new mongoose.Schema({

    domain: {
        type: String,
        unique: true
    },

    owner: String,

    cname: {
        type: String,
        default: null
    },

    mx: {
        type: String,
        default: null
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

})



const UploadSchema =
new mongoose.Schema({

    id: {
        type: String,
        unique: true
    },

    owner: String,

    originalName: String,

    compressed: Buffer,

    createdAt: {
        type: Date,
        default: Date.now
    }

})



const MailAccountSchema =
new mongoose.Schema({

    address: {
        type: String,
        unique: true
    },

    password: String,

    owner: String,

    createdAt: {
        type: Date,
        default: Date.now
    }

})



const MailSchema =
new mongoose.Schema({

    domain: String,

    from: String,

    to: String,

    subject: String,

    body: String,

    createdAt: {
        type: Date,
        default: Date.now
    }

})



const User =
mongoose.model(
    "User",
    UserSchema
)

const Domain =
mongoose.model(
    "Domain",
    DomainSchema
)

const UploadModel =
mongoose.model(
    "Upload",
    UploadSchema
)

const MailAccount =
mongoose.model(
    "MailAccount",
    MailAccountSchema
)

const Mail =
mongoose.model(
    "Mail",
    MailSchema
)

// =========================
// AUTH
// =========================

function createToken(user) {

    return jwt.sign(

        {
            id: user._id,
            username: user.username
        },

        JWT_SECRET,

        {
            expiresIn: "30d"
        }

    )

}



async function auth(
    req,
    res,
    next
) {

    try {

        const header =
            req.headers.authorization

        if (!header)
            return res
            .status(401)
            .json({
                error: "No token"
            })

        const token =
            header.split(" ")[1]

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            )

        req.user = decoded

        next()

    } catch {

        res
        .status(401)
        .json({
            error: "Invalid token"
        })

    }

}

// =========================
// AUTH ROUTES
// =========================

app.post(
    "/auth/register",

    async (req, res) => {

        try {

            const {
                username,
                password
            } = req.body

            if (
                !username ||
                !password
            )
                return res
                .status(400)
                .json({
                    error:
                    "Missing fields"
                })

            const exists =
                await User.findOne({
                    username
                })

            if (exists)
                return res
                .status(400)
                .json({
                    error:
                    "Username taken"
                })

            const hashed =
                await bcrypt.hash(
                    password,
                    10
                )

            const user =
                await User.create({

                    username,

                    password:
                        hashed

                })

            const token =
                createToken(user)

            res.json({

                token,

                username,

                lucks: 0

            })

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.post(
    "/auth/login",

    async (req, res) => {

        try {

            const {
                username,
                password
            } = req.body

            const user =
                await User.findOne({
                    username
                })

            if (!user)
                return res
                .status(404)
                .json({
                    error:
                    "User not found"
                })

            const valid =
                await bcrypt.compare(
                    password,
                    user.password
                )

            if (!valid)
                return res
                .status(400)
                .json({
                    error:
                    "Invalid password"
                })

            const token =
                createToken(user)

            res.json({

                token,

                username:
                    user.username,

                lucks:
                    user.lucks

            })

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.get(
    "/me",
    auth,

    async (req, res) => {

        const user =
            await User.findById(
                req.user.id
            )

        res.json({

            username:
                user.username,

            lucks:
                user.lucks

        })

    }

)

// =========================
// LUCKS
// =========================

app.post(
    "/lucks/add",

    async (req, res) => {

        try {

            const apiKey =
                req.headers[
                    "x-api-key"
                ]

            if (
                apiKey !==
                LUCKS_API_KEY
            )
                return res
                .status(403)
                .json({
                    error:
                    "Invalid API key"
                })

            const {
                username,
                amount
            } = req.body

            const user =
                await User.findOne({
                    username
                })

            if (!user)
                return res
                .status(404)
                .json({
                    error:
                    "User not found"
                })

            user.lucks +=
                Number(amount)

            await user.save()

            res.json({

                success: true,

                balance:
                    user.lucks

            })

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)

// =========================
// DOMAINS
// =========================

app.post(
    "/domains/register",
    auth,

    async (req, res) => {

        try {

            const { domain } =
                req.body

            if (!domain)
                return res
                .status(400)
                .json({
                    error:
                    "Missing domain"
                })

            const exists =
                await Domain.findOne({
                    domain
                })

            if (exists)
                return res
                .status(400)
                .json({
                    error:
                    "Domain taken"
                })

            const allowed = [
                ".green",
                ".party",
                ".lbc",
                ".cc"
            ]

            const valid =
                allowed.some(
                    ext =>
                    domain.endsWith(ext)
                )

            if (!valid)
                return res
                .status(400)
                .json({
                    error:
                    "Invalid extension"
                })

            const user =
                await User.findById(
                    req.user.id
                )

            if (
                user.lucks <
                DOMAIN_PRICE
            )
                return res
                .status(400)
                .json({
                    error:
                    "Not enough lucks"
                })

            user.lucks -=
                DOMAIN_PRICE

            await user.save()

            const created =
                await Domain.create({

                    domain,

                    owner:
                        user.username

                })

            res.json(created)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.post(
    "/domains/cname",
    auth,

    async (req, res) => {

        try {

            const {
                domain,
                cname
            } = req.body

            const found =
                await Domain.findOne({
                    domain
                })

            if (!found)
                return res
                .status(404)
                .json({
                    error:
                    "Domain not found"
                })

            if (
                found.owner !==
                req.user.username
            )
                return res
                .status(403)
                .json({
                    error:
                    "Unauthorized"
                })

            found.cname =
                cname

            await found.save()

            res.json(found)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.post(
    "/domains/mx",
    auth,

    async (req, res) => {

        try {

            const {
                domain,
                mx
            } = req.body

            const found =
                await Domain.findOne({
                    domain
                })

            if (!found)
                return res
                .status(404)
                .json({
                    error:
                    "Domain not found"
                })

            if (
                found.owner !==
                req.user.username
            )
                return res
                .status(403)
                .json({
                    error:
                    "Unauthorized"
                })

            found.mx = mx

            await found.save()

            res.json(found)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.get(
    "/domains/:domain",

    async (req, res) => {

        try {

            const found =
                await Domain.findOne({

                    domain:
                    req.params.domain

                })

            if (!found)
                return res
                .status(404)
                .json({
                    error:
                    "Not found"
                })

            res.json(found)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)

// =========================
// SEARCH ENGINE
// =========================

app.get(
    "/search",

    async (req, res) => {

        try {

            const q =
                req.query.q || ""

            const domains =
                await Domain.find({

                    domain: {
                        $regex: q,
                        $options: "i"
                    }

                }).limit(50)

            const scored =
                domains.map(domain => {

                    let score = 0

                    if (
                        domain.domain
                        .startsWith(q)
                    )
                        score += 10

                    if (
                        domain.domain
                        .includes(q)
                    )
                        score += 5

                    if (domain.cname)
                        score += 2

                    return {

                        ...domain.toObject(),

                        relevance: score

                    }

                })

            scored.sort(
                (a, b) =>
                b.relevance -
                a.relevance
            )

            res.json(scored)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)

// =========================
// HTML HOST
// =========================

app.post(
    "/upload",
    auth,

    async (req, res) => {

        try {

            const {
                html,
                name
            } = req.body

            if (!html)
                return res
                .status(400)
                .json({
                    error:
                    "Missing HTML"
                })

            const compressed =
                zlib.gzipSync(
                    Buffer.from(html)
                )

            const id =
                uuidv4()

            await UploadModel.create({

                id,

                owner:
                    req.user.username,

                originalName:
                    name || "index.html",

                compressed

            })

            res.json({

                success: true,

                id,

                url:
                `/upload/${id}`

            })

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.get(
    "/upload/:id",

    async (req, res) => {

        try {

            const upload =
                await UploadModel.findOne({

                    id:
                    req.params.id

                })

            if (!upload)
                return res
                .status(404)
                .send("Not found")

            const decompressed =
                zlib.gunzipSync(
                    upload.compressed
                )

            res.setHeader(
                "Content-Type",
                "text/html"
            )

            res.send(
                decompressed
            )

        } catch (e) {

            res
            .status(500)
            .send(e.message)

        }

    }

)

// =========================
// MAIL SYSTEM
// =========================

app.post(
    "/mail/create",
    auth,

    async (req, res) => {

        try {

            const {
                address,
                password
            } = req.body

            if (
                !address ||
                !password
            )
                return res
                .status(400)
                .json({
                    error:
                    "Missing fields"
                })

            const exists =
                await MailAccount.findOne({
                    address
                })

            if (exists)
                return res
                .status(400)
                .json({
                    error:
                    "Already exists"
                })

            const domain =
                address.split("@")[1]

            const domainData =
                await Domain.findOne({
                    domain
                })

            if (!domainData)
                return res
                .status(404)
                .json({
                    error:
                    "Domain not found"
                })

            if (!domainData.mx)
                return res
                .status(400)
                .json({
                    error:
                    "No MX record"
                })

            if (
                domainData.owner !==
                req.user.username
            )
                return res
                .status(403)
                .json({
                    error:
                    "Unauthorized"
                })

            const hashed =
                await bcrypt.hash(
                    password,
                    10
                )

            await MailAccount.create({

                address,

                password:
                    hashed,

                owner:
                    req.user.username

            })

            res.json({
                success: true
            })

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.post(
    "/mail/:domain/:user/send",

    async (req, res) => {

        try {

            const {
                password,
                to,
                subject,
                body
            } = req.body

            const address =
                `${req.params.user}@${req.params.domain}`

            const account =
                await MailAccount.findOne({
                    address
                })

            if (!account)
                return res
                .status(404)
                .json({
                    error:
                    "Mail account not found"
                })

            const valid =
                await bcrypt.compare(
                    password,
                    account.password
                )

            if (!valid)
                return res
                .status(403)
                .json({
                    error:
                    "Invalid password"
                })

            const created =
                await Mail.create({

                    domain:
                        req.params.domain,

                    from:
                        address,

                    to,

                    subject,

                    body

                })

            res.json(created)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)



app.post(
    "/mail/:domain/:user/inbox",

    async (req, res) => {

        try {

            const { password } =
                req.body

            const address =
                `${req.params.user}@${req.params.domain}`

            const account =
                await MailAccount.findOne({
                    address
                })

            if (!account)
                return res
                .status(404)
                .json({
                    error:
                    "Mail account not found"
                })

            const valid =
                await bcrypt.compare(
                    password,
                    account.password
                )

            if (!valid)
                return res
                .status(403)
                .json({
                    error:
                    "Invalid password"
                })

            const inbox =
                await Mail.find({
                    to: address
                }).sort({
                    createdAt: -1
                })

            res.json(inbox)

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)

// =========================
// DOMAIN RESOLVER
// =========================

app.get(
    "/resolve/:domain",

    async (req, res) => {

        try {

            const found =
                await Domain.findOne({

                    domain:
                    req.params.domain

                })

            if (!found)
                return res
                .status(404)
                .json({
                    error:
                    "Not found"
                })

            res.json({

                domain:
                    found.domain,

                owner:
                    found.owner,

                cname:
                    found.cname,

                mx:
                    found.mx

            })

        } catch (e) {

            res
            .status(500)
            .json({
                error: e.message
            })

        }

    }

)

// =========================
// HEALTH
// =========================

app.get("/", (req, res) => {

    res.json({

        name:
        "Luciano Web Backend",

        online: true,

        version: "1.0"

    })

})

// =========================
// EXPORT FOR VERCEL
// =========================

module.exports = app
