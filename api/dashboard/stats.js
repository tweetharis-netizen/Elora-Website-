import { getSessionTokenFromReq, fetchBackendStatus } from "@/lib/server/verification";

// In-memory "database" for verification demo
// Key: sessionToken, Value: userStats object
const MOCK_DB = new Map();

const DEFAULT_STATS = {
    student: {
        overallProgress: 0,
        streak: 0,
        todayMinutes: 0,
        recentTopics: [
            { name: "Fractions", progress: 0, emoji: "🔢" },
            { name: "Decimals", progress: 0, emoji: "📊" },
        ],
        achievements: [
            { title: "First Steps", desc: "Complete your first lesson", earned: false },
            { title: "Streak Master", desc: "5 day learning streak", earned: false },
        ]
    }
};

export default async function handler(req, res) {
    // 1. Identify User
    const token = getSessionTokenFromReq(req);
    if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // 2. Gate access (Verify user exists/is verified)
    // In a real app, strict verification; for this demo, existence of session is enough
    // but we can check status to be sure.
    const status = await fetchBackendStatus(token);
    if (!status.ok) {
        return res.status(401).json({ error: "Invalid Session" });
    }

    // 3. Get or Init Data
    let stats = MOCK_DB.get(token);
    if (!stats) {
        stats = JSON.parse(JSON.stringify(DEFAULT_STATS)); // deep copy
        MOCK_DB.set(token, stats);
    }

    // 4. Handle Request
    if (req.method === "GET") {
        return res.status(200).json({
            ok: true,
            stats: stats.student
        });
    }

    if (req.method === "POST") {
        const { action } = req.body;

        // Simple logic to simulate "real functionality"
        if (action === "complete_lesson") {
            stats.student.overallProgress = Math.min(100, stats.student.overallProgress + 10);
            stats.student.todayMinutes += 15;
            stats.student.streak = 1; // Start streak

            // Update first topic
            if (stats.student.recentTopics[0]) {
                stats.student.recentTopics[0].progress = Math.min(100, stats.student.recentTopics[0].progress + 25);
            }

            // Unlock achievements
            if (stats.student.overallProgress >= 10) {
                stats.student.achievements[0].earned = true;
            }
        }

        MOCK_DB.set(token, stats); // Save back
        return res.status(200).json({
            ok: true,
            stats: stats.student,
            message: "Progress updated!"
        });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
}
