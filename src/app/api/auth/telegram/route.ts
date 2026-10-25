import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";
import { langFromTelegram } from "@/lib/i18n";
import { z } from "zod";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  const body=z.object({initData:z.string().min(1)}).parse(await req.json());
  const tg=validateTelegramInitData(body.initData,process.env.BOT_TOKEN??"",Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS??86400));
  // Yangi foydalanuvchi tili Telegram tilidan olinadi; mavjud foydalanuvchining tanlangan tili o'zgartirilmaydi.
  const user=await prisma.user.upsert({where:{telegramId:String(tg.id)},update:{firstName:tg.first_name,lastName:tg.last_name,username:tg.username},create:{telegramId:String(tg.id),firstName:tg.first_name,lastName:tg.last_name,username:tg.username,language:langFromTelegram(tg.language_code)}});
  return NextResponse.json({id:user.id,firstName:user.firstName,username:user.username,language:user.language==="ru"?"ru":"uz",isBlocked:user.isBlocked});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Autentifikatsiya bajarilmadi."},{status:401});}
}
