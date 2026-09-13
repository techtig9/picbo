import {NextResponse} from "next/server";
import {SOCIAL_PRESETS} from "@/lib/social/platform-presets";
export async function GET(){return NextResponse.json({presets:Object.values(SOCIAL_PRESETS)})}
