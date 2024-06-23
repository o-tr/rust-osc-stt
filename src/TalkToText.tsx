import {FC, useEffect, useRef, useState} from 'react'
import { useAtomValue } from 'jotai'
import { ConfigAtom } from './atoms/config'
import IWindow, { ISpeechRecognition } from './type';
import styles from "./TalkToText.module.scss"
import {isSomeConditionSatisfied, kanaToHira} from "./utils.ts";
import {invoke} from "@tauri-apps/api/tauri";
import {Button} from "antd";

declare const window: IWindow;

const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;

export const TalkToText: FC = () => {
  const config = useAtomValue(ConfigAtom)
  const [log, setLog] = useState<string[]>([]);
  const [keywordLog, setKeywordLog] = useState<string[]>([]);
  const [lastText, setLastText] = useState<string>("");
  const [text, setText] = useState('')
  const [isActive, setIsActive] = useState(true);
  const recognition = useRef<ISpeechRecognition>();
  const selectedDeviceId = config.audio.deviceId
  
  useEffect(() => {
    void (async()=>{
      if (recognition.current) recognition.current.abort();
      await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedDeviceId } })
      recognition.current = new SpeechRecognition()
      recognition.current.lang = 'ja-JP';
      recognition.current.interimResults = true;
      recognition.current.onend = () => {
        recognition.current?.start()
      }
      recognition.current.onerror = (...args) => {
        console.log(args)
      }
      recognition.current.onresult = (event) => {
        const data = event.results[0];
        const text = kanaToHira(data[0]?.transcript??"").replace(/。/g,"").trim();
        if (data.isFinal){
          setText("");
          setLastText(text);
          setLog(_pv=>[text,..._pv])
        }else{
          setText(text)
        }
      }
      recognition.current.start()
    })();
    return () => {
      recognition.current?.abort()
      recognition.current = undefined
    }
  }, [selectedDeviceId])
  
  useEffect(()=>{
    if (lastText === "") return;
    setLastText("")
    if (isSomeConditionSatisfied(config.startWords, lastText)){
      setKeywordLog(_pv=>["判定開始",..._pv])
      setIsActive(true)
      return;
    }else if (isSomeConditionSatisfied(config.stopWords, lastText)){
      setKeywordLog(_pv=>["判定停止",..._pv])
      setIsActive(false)
      return;
    }
    if (!isActive) return
    for (const keyword of config.keywords){
      if (isSomeConditionSatisfied(keyword.conditions, lastText)){
        setKeywordLog(_pv=>[`${keyword.name}: ${keyword.osc.key}->${keyword.osc.value}(${keyword.osc.type})`,..._pv])
        void invoke("send", {key: keyword.osc.key, value: keyword.osc.value, variant: keyword.osc.type, target:config.remote});
        return;
      }
    }
  },[lastText,config]);
  
  return <div className={styles.wrapper}>
    <div className={styles.logContainer}>
      <div className={styles.log}>
        <p style={{color: "gray"}}>{text}</p>
        {log.map((v, i) => <p key={i}>{v}</p>)}
      </div>
      <div className={styles.log}>
        {keywordLog.map((v, i) => <p key={i}>{v}</p>)}
      </div>
    </div>
    <Button onClick={()=>setIsActive((pv)=>{
      if (pv){
        setKeywordLog(_pv=>["判定停止",..._pv])
      }else{
        setKeywordLog(_pv=>["判定開始",..._pv])
      }
      return !pv;
    })}>{isActive?"判定中":"判定停止中"}</Button>
  </div>
}
