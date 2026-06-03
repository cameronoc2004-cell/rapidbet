// Central service singletons. Import from here, never from concrete modules.
//
//   import { notifier, payment, kyc } from "@/lib/services";

import { supabaseAuth } from "./auth/supabase";
import { supabaseStorage } from "./storage/supabase";
import { resendEmailer } from "./email/resend";
import { fcmPusher } from "./push/fcm";
import { trustlyProvider } from "./payment/trustly";
import { diditKyc } from "./kyc/didit";
import { dataProvider } from "./data/stub";
import { realMoneyGeoProvider } from "./geo/realmoney";
import { createNotifier } from "./notifier";

export const auth = supabaseAuth;
export const storage = supabaseStorage;
export const email = resendEmailer;
export const push = fcmPusher;
export const payment = trustlyProvider;
export const kyc = diditKyc;
export const data = dataProvider;
export const realMoneyGeo = realMoneyGeoProvider;

export const notifier = createNotifier({ email, push });

export * from "./types";
