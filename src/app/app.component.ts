import { Component, Inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { take } from 'rxjs/operators';

import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import AdyenCheckout from '@adyen/adyen-web';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  public customCard = null;
  public customIdeal = null;
  private disablePay = false;
  private authHeaders = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    public dialog: MatDialog
  ) {
    this.authHeaders = new HttpHeaders()
    .set('Content-Type', 'application/json')
    .set('X-API-Key', 'AQEyhmfxLI3MaBFLw0m/n3Q5qf3VaY9UCJ14XWZE03G/k2NFitRvbe4N1XqH1eHaH2AksaEQwV1bDb7kfNy1WIxIIkxgBw==-y3qzswmlmALhxaVPNjYf74bqPotG12HroatrKA066yE=-W+t7NF;s4}%=kUSD');
  }

  ngOnInit() {
    this.router.events.pipe(take(1)).subscribe( (event: any) => {
      if (event.url !== "/") {
        this.disablePay = true;

        const redirectResult = event.url.split('=')[1];
        this.http.post("/payments/details",{
          "details": {
            "redirectResult": redirectResult
          }
        },{
          headers: this.authHeaders
        }).pipe(take(1)).subscribe( (response: any) => {
          console.log("redirect resposnse: ", response);
          this.disablePay = false;

          this.dialog.open(PaymentDialog, {
            width: '250px',
            data: response.resultCode
          });
        },
        (error: any) => {
          console.log("Bad Redirect");
          this.disablePay = false;
          this.dialog.open(PaymentDialog, {
            width: '250px',
            data: "Error"
          });
        });
        this.router.navigateByUrl("/");
      }
    });

    const configuration = {
      locale: "en_NL",
      environment: "test",
      clientKey: "test_CIXAPNBW2JERLEJ6GYYC3WBLVMO2HIZ3"
    };
    const checkout = new AdyenCheckout(configuration);
    this.customCard = checkout.create("card").mount('#card-container');

    const paymentMethodsBody = {
      "merchantAccount": "AdyenRecruitmentCOM",
      "countryCode": "NL",
      "shopperLocale": "nl-NL",
      "amount": {
        "currency": "EUR",
        "value": 1000
        }
    }
    const paymentMethodsRequest = this.http.post("/paymentMethods",paymentMethodsBody,{
      headers: this.authHeaders
    });
    paymentMethodsRequest.subscribe( (response: any) => {
      if (response) {
        console.log(response);
        const iDealConfig = {
          locale: "en_US",
          environment: "test",
          clientKey: "test_CIXAPNBW2JERLEJ6GYYC3WBLVMO2HIZ3",
          paymentMethodsResponse: response
        };
        const iDealCheckout = new AdyenCheckout(iDealConfig);
        this.customIdeal = iDealCheckout.create('ideal').mount('#ideal-container');
      }
    });
  }

  getCardDetails() {
    if (this.customCard.state.data) {
      const cardDetails = {
        number: this.customCard.state.data.encryptedCardNumber,
        month: this.customCard.state.data.encryptedExpiryMonth,
        year: this.customCard.state.data.encryptedExpiryYear,
        code: this.customCard.state.data.encryptedSecurityCode 
      }
      return cardDetails;
    }
    return null;
  }

  isCardReady() {
    const card = this.getCardDetails();

    if (card && card.number && card.month && card.year && card.code && !this.disablePay) {
      return true;
    }
    else {
      return false;
    }
  }

  payByCard() {
    this.disablePay = true;

    const card = this.getCardDetails();
    const body = {
      "amount": {
        "currency": "USD",
        "value": 1000
      },
      "reference": "{SyedYusha}_checkoutChallenge",
      "paymentMethod": {
        "type": "scheme",
        "encryptedCardNumber": card.number,
        "encryptedExpiryMonth": card.month,
        "encryptedExpiryYear": card.year,
        "encryptedSecurityCode": card.code
      },
      "browserInfo":{
        "userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36 Edg/91.0.864.48",
        "acceptHeader": "text\/html,application\/xhtml+xml,application\/xml;q=0.9,image\/webp,image\/apng,*\/*;q=0.8",
        "language": "nl-NL",
        "colorDepth": 24,
        "screenHeight": 723,
        "screenWidth": 1536,
        "timeZoneOffset": 0,
        "javaEnabled": true
      },
      "returnUrl": "http://localhost:8080/",
      "merchantAccount": "AdyenRecruitmentCOM"
    }

    const paymentObject = this.http.post("/payments",body,{
      headers: this.authHeaders
    });

    paymentObject.pipe(take(1)).subscribe( (response: any) => {
      console.log(response);
      
      if (response.action) { // Do 3ds by redirecting to other website and return to returnUrl once done.
        console.log("has action");
        this.customCard.handleAction(response.action);
      }
      else { // No 3ds required, show if payment suceeded or failed.
        this.disablePay = false;

        this.dialog.open(PaymentDialog, {
          width: '250px',
          data: response.resultCode
        });
      }
    },
    (error) => { // Unable to make payment.
      console.log("payment failed");
      this.disablePay = false;
      this.dialog.open(PaymentDialog, {
        width: '250px',
        data: "Error"
      });
    });   
  }

  isIDealReady() {
    if (this.getIssuer() && !this.disablePay) {
      return true;
    }
    return false;
  }

  getIssuer() {
    if (this.customIdeal && this.customIdeal.state.data) {
      return this.customIdeal.state.data.issuer;
    }
    return null;
  }

  payWithIDeal() {

    this.disablePay = true;

    const iDealPaymentBody = {
      "amount": {
        "currency": "EUR",
        "value": 1000
      },
      "reference": "{SyedYusha}_checkoutChallenge",
      "paymentMethod": {
        "type": "ideal",
        "issuer": this.getIssuer()
      },
      "returnUrl": "http://localhost:8080/",
      "merchantAccount": "AdyenRecruitmentCOM"
    }
    this.http.post("/payments", iDealPaymentBody, {
      headers: this.authHeaders
    }).pipe(take(1)).subscribe((response: any) => {
      console.log("iDeal Payment Response: ", response);
      this.customIdeal.handleAction(response.action);
    });
  }
}

@Component({
  selector: 'dialog-payment',
  templateUrl: 'payment-dialog.html'
})
export class PaymentDialog {

  constructor(
    public dialogRef: MatDialogRef<PaymentDialog>,
    @Inject(MAT_DIALOG_DATA) public data: string
  ) {}

  closeDialog(): void {
    this.dialogRef.close();
  }

}