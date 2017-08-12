#include <Wire.h>
const byte TERABEE_MULTIFLEX=85; // hex 0x55 or 85 dec
const byte CARTE_MERE=1;

int distRaw []={0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0};
int distReal []={0,0,0,0,0,0,0,0};
int i=0;

void setup() {
  // put your setup code here, to run once:
  Serial.begin(9600);
  Wire.begin(CARTE_MERE); //demarage du protocole I2C, Adresse= CARTE_MERE
 // Wire.onReceive (receiveEvent); //fonction de reception
}

long reading=0;

void loop() {

 /* Wire.beginTransmission(TERABEE_MULTIFLEX); // transmit to device #112 (0x70)

  Wire.write(byte(0xAB));      // sets register pointer to the command register (0x00)

  Wire.endTransmission();      // stop transmitting

  // step 2: wait for readings to happen
  delay(200);                   // datasheet suggests at least 65 milliseconds*/

  // step 3: instruct sensor to return a particular echo reading
  Wire.beginTransmission(TERABEE_MULTIFLEX); // transmit to device #112
  Wire.write(byte(0x00));
  Wire.endTransmission();      // stop transmitting
  delay(70);
  // step 4: request reading from sensor
  Wire.requestFrom(TERABEE_MULTIFLEX, 18);    // request 18 bytes from slave device #85
i=0;
while(Wire.available())    // slave may send less than requested
  {
    distRaw [i] = Wire.read();
    //Serial.print(distRaw[i]);
    //Serial.print("   ");
    i++;
  }

  for(int b=0; b<8; b++){
    distReal[b]= distRaw[b*2]*256+distRaw[b*2+1];
  }
  for(int b=0; b<8; b++){
    Serial.print(distReal[b]);
    Serial.print("   ");
  }
 // distReal[0]=distRaw[1]+256*distRaw[2];
 // Serial.print(distReal[0]);
Serial.println("");


  // step 5: receive reading from sensor
/*  if (2 <= Wire.available()) { // if two bytes were received
    dist [0] = Wire.read();  // receive high byte (overwrites previous reading)
    dist [0] = dist [0] << 8;    // shift high byte to be high 8 bits
    dist [0] |= Wire.read(); // receive low byte as lower 8 bits
    Serial.println(dist [0]);   // print the reading
  }*/

  delay(50);                  //
