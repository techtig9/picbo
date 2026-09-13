import {NextResponse} from "next/server";
import {STARTER_TEMPLATES} from "@/lib/growth/templates";
export async function GET(){return NextResponse.json({templates:STARTER_TEMPLATES})}
